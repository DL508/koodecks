// scripts/classroom-test.js
// Validates the Google Classroom share slice: the share-URL builder is correct
// and safe, both surfaces wire it up, and — importantly — the integration uses
// NO OAuth, NO roster/API access, and sends NO student data (it's a plain link).
//
// Run with:  node scripts/classroom-test.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const PUB = path.join(__dirname, "..", "public");
let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log("  \u2714", name); }
  catch (e) { fail++; console.log("  \u2718", name, "\u2192", e.message); }
};

// Load the shared helper in an isolated context (needs a browser-like global).
const ctx = { self: {}, encodeURIComponent };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(PUB, "classroom.js"), "utf8"), ctx);
const build = ctx.self.KooDeckClassroom.classroomShareUrl;

console.log("\n1) Share-URL builder");
t("targets the Google Classroom share endpoint", () => {
  const u = build("https://koodeck.app/d/happy-otter-1234", "My Deck");
  assert.ok(u.startsWith("https://classroom.google.com/share?"), u);
});
t("includes the deck URL, encoded", () => {
  const u = build("https://koodeck.app/d/happy-otter-1234", "My Deck");
  assert.ok(u.includes("url=" + encodeURIComponent("https://koodeck.app/d/happy-otter-1234")));
});
t("includes the title, encoded", () => {
  const u = build("https://x.com/d/a", "Volcanoes & Lava!");
  assert.ok(u.includes("title=" + encodeURIComponent("Volcanoes & Lava!")));
});
t("encodes special characters safely (no injection into the query)", () => {
  const u = build("https://x.com/d/a", 'Bad "title" <x> & ?y=z');
  assert.ok(!/[<>"]/.test(u.split("title=")[1] || ""), "title not fully encoded");
});
t("works without a title", () => {
  const u = build("https://x.com/d/a");
  assert.ok(u.startsWith("https://classroom.google.com/share?url=") && !u.includes("title="));
});
t("caps very long titles", () => {
  const u = build("https://x.com/d/a", "z".repeat(500));
  const title = decodeURIComponent((u.split("title=")[1] || ""));
  assert.ok(title.length <= 120, "title length " + title.length);
});
t("returns null for a missing deck URL (no half-built links)", () => {
  assert.equal(build("", "t"), null);
});

console.log("\n2) Both surfaces wire the button to the helper");
const share = fs.readFileSync(path.join(PUB, "share.html"), "utf8");
const index = fs.readFileSync(path.join(PUB, "index.html"), "utf8");
const app = fs.readFileSync(path.join(PUB, "app.js"), "utf8");
t("share page has the Classroom button", () => assert.ok(/id="gc-btn"/.test(share)));
t("share page loads classroom.js", () => assert.ok(/classroom\.js/.test(share)));
t("share page calls the helper", () => assert.ok(/KooDeckClassroom\.classroomShareUrl/.test(share)));
t("app page has the Classroom button", () => assert.ok(/id="gc-btn"/.test(index)));
t("app loads classroom.js", () => assert.ok(/classroom\.js/.test(index)));
t("app.js calls the helper", () => assert.ok(/KooDeckClassroom\.classroomShareUrl/.test(app)));
t("button carries a teacher 'review before assigning' prompt", () =>
  assert.ok(/review before assigning/i.test(share) && /review before assigning/i.test(index)));

console.log("\n3) Click actually opens Classroom (jsdom)");
{
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><body><button id="gc-btn"></button></body>', { runScripts: "outside-only" });
  dom.window.eval(fs.readFileSync(path.join(PUB, "classroom.js"), "utf8"));
  let opened = null;
  dom.window.open = (url) => { opened = url; return null; };
  // Mirror the exact handler both surfaces use.
  const deck = { slug: "brave-otter-4218", title: "Volcanoes 101" };
  dom.window.document.getElementById("gc-btn").addEventListener("click", () => {
    const deckUrl = "https://koodeck.app/d/" + deck.slug;
    dom.window.open(dom.window.self.KooDeckClassroom.classroomShareUrl(deckUrl, deck.title), "_blank", "noopener");
  });
  dom.window.document.getElementById("gc-btn").dispatchEvent(new dom.window.Event("click"));
  t("clicking opens a classroom.google.com/share link", () =>
    assert.ok(opened && opened.startsWith("https://classroom.google.com/share?url=")));
  t("opened link carries the deck URL", () =>
    assert.ok(opened.includes(encodeURIComponent("https://koodeck.app/d/brave-otter-4218"))));
}

console.log("\n4) SAFETY: no OAuth, no roster, no student data anywhere");
const scanFiles = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (f !== "node_modules") walk(p); }
    else if (/\.(js|html|json)$/.test(f)) scanFiles.push(p);
  }
}
walk(path.join(__dirname, "..", "public"));
walk(path.join(__dirname, "..", "lib"));
scanFiles.push(path.join(__dirname, "..", "server.js"));
// Strip comments so our own reassuring notes ("no roster access") don't trip the
// scan — we want to catch actual API *usage*, not prose about avoiding it.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")   // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1") // line comments (leave http:// alone)
    .replace(/<!--[\s\S]*?-->/g, "");    // html comments
}
const corpus = scanFiles.map((f) => stripComments(fs.readFileSync(f, "utf8"))).join("\n");
t("no Classroom API OAuth scopes requested", () =>
  assert.ok(!/auth\/classroom/i.test(corpus), "found a classroom OAuth scope"));
t("no Google OAuth client / token flow", () =>
  assert.ok(!/oauth2|client_secret|gapi\.auth|accounts\.google\.com\/o\/oauth/i.test(corpus)));
t("no Classroom REST API calls", () =>
  assert.ok(!/classroom\.googleapis\.com/i.test(corpus)));
t("no roster / coursework / student-list API access", () =>
  assert.ok(!/\.rosters\b|courses\/[^"'\s]*\/students|\.coursework\b|courseWork/i.test(corpus)));
t("the only Classroom reference is the safe share endpoint", () => {
  const hits = (corpus.match(/classroom\.google\.com[^"'\s]*/g) || []);
  assert.ok(hits.length > 0, "expected at least one share link");
  hits.forEach((h) => assert.ok(h.startsWith("classroom.google.com/share"), "unexpected classroom URL: " + h));
});

console.log(`\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ${pass} passed, ${fail} failed\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
process.exit(fail ? 1 : 0);
