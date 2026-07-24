process.env.KOO_TEST_BYPASS_AUTH = "1";
// scripts/remix-test.js
// Validates the "Make one like this" viewer-to-creator feature and the
// substance cache, end to end with the Claude API mocked.
//
// Run with:  node scripts/remix-test.js

process.env.DATA_DIR = require("os").tmpdir() + "/brightdeck-remix-" + Date.now();
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.PORT = "3901";

const assert = require("assert");
const fs = require("fs");

let pass = 0, fail = 0;
const t = (name, fn) =>
  Promise.resolve().then(fn).then(
    () => { pass++; console.log("  \u2714", name); },
    (e) => { fail++; console.log("  \u2718", name, "\u2192", e.message); }
  );

// ---- Mock Claude + transcript so create runs without cost, and COUNT calls ----
const SUBSTANCE = {
  appropriate: true, topic: "Volcanoes",
  big_idea: "Volcanoes erupt when melted rock is pushed up to the surface.",
  hook: "Some mountains can explode!",
  key_points: [{ title: "Magma", detail: "Melted rock underground." }, { title: "Pressure", detail: "Gases push it up." }],
  steps: [], numbers: [{ value: "1000C", meaning: "how hot lava gets" }],
  vocab: [{ word: "magma", kid_definition: "melted rock" }],
  fun_fact: "There are volcanoes under the ocean.", takeaway: "Earth letting off steam.",
  quiz: [{ q: "What is magma outside?", a: "Lava." }, { q: "What builds up?", a: "Pressure." }],
};
const LAYOUT = {
  headline: "Boom! How Volcanoes Work", subhead: "Why mountains explode", hero_emoji: "🌋",
  cards: [{ type: "big_idea", size: "xl", emoji: "💡", title: "" }, { type: "points", size: "lg", emoji: "🔑", title: "Key ideas" }, { type: "takeaway", size: "lg", emoji: "🎒", title: "" }],
};
let claudeCalls = 0;
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("api.anthropic.com")) {
    claudeCalls++;
    const body = JSON.parse(opts.body);
    const isStage1 = body.messages[0].content.includes("Transcript");
    const payload = isStage1 ? SUBSTANCE : LAYOUT;
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(payload) }] }),
      { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("youtube.com/oembed")) {
    return new Response(JSON.stringify({ title: "Volcanoes 101", author_name: "SciKids", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" }),
      { status: 200, headers: { "content-type": "application/json" } });
  }
  return realFetch(url, opts);
};
const LONG_TEXT = "Volcanoes are amazing geological features that erupt molten rock. ".repeat(40);

(async () => {
  require("../server.js");
  await new Promise((r) => setTimeout(r, 600));
  const base = "http://localhost:3901";
  const j = (r) => r.json();
  const post = (path, body, headers) =>
    realFetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...(headers || {}) }, body: JSON.stringify(body) });

  console.log("\n1) Substance cache — repeat videos skip the AI");
  claudeCalls = 0;
  const first = await post("/api/decks", { pastedText: LONG_TEXT, url: "https://youtu.be/vvvvvvvvvvv", gradeBand: "35", theme: "space" }).then(j);
  await t("first deck of a video runs the pipeline (2 AI calls)", () => assert.equal(claudeCalls, 2));
  await t("first deck created", () => assert.ok(first.slug));

  claudeCalls = 0;
  const second = await post("/api/decks", { pastedText: LONG_TEXT, url: "https://youtu.be/vvvvvvvvvvv", gradeBand: "35", theme: "ocean" }, { "x-forwarded-for": "2.2.2.2" }).then(j);
  await t("SAME video + level again → 0 AI calls (cache hit)", () => assert.equal(claudeCalls, 0));
  await t("cached deck still gets its own slug", () => assert.ok(second.slug && second.slug !== first.slug));
  await t("cached deck keeps the requested (different) theme", () => assert.equal(second.deck.theme, "ocean"));
  await t("cached deck reuses the substance", () => assert.equal(second.deck.substance.topic, "Volcanoes"));

  claudeCalls = 0;
  await post("/api/decks", { pastedText: LONG_TEXT, url: "https://youtu.be/vvvvvvvvvvv", gradeBand: "k2", theme: "space" }, { "x-forwarded-for": "3.3.3.3" }).then(j);
  await t("DIFFERENT level of same video → cache miss, pipeline runs", () => assert.equal(claudeCalls, 2));

  console.log("\n2) Remix endpoint — the viewer-to-creator loop");
  claudeCalls = 0;
  const remix = await post(`/api/decks/${first.slug}/remix`, { theme: "candy", title: "Sam's Volcano Deck", authorName: "Sam" }).then(j);
  await t("remix makes ZERO AI calls (free)", () => assert.equal(claudeCalls, 0));
  await t("remix returns a brand-new slug", () => assert.ok(remix.slug && remix.slug !== first.slug));
  await t("remix returns an editKey to the new creator", () => assert.ok(remix.editKey));
  await t("remix applies the chosen theme", () => assert.equal(remix.deck.theme, "candy"));
  await t("remix applies the chosen title + name", () => {
    assert.equal(remix.deck.title, "Sam's Volcano Deck");
    assert.equal(remix.deck.authorName, "Sam");
  });
  await t("remix reuses the source's substance & video", () => {
    assert.equal(remix.deck.substance.big_idea, SUBSTANCE.big_idea);
    assert.equal(remix.deck.videoTitle, "Volcanoes 101");
  });
  await t("remix records its lineage (remixedFrom)", () => assert.equal(remix.deck.remixedFrom, first.slug));
  await t("remix response deck does NOT leak the editKey", () => assert.equal(remix.deck.editKey, undefined));

  console.log("\n3) Remix defaults & validation");
  const bare = await post(`/api/decks/${first.slug}/remix`, {}).then(j);
  await t("no fields → falls back to source theme + title, empty author", () => {
    assert.equal(bare.deck.theme, first.deck.theme);
    assert.equal(bare.deck.title, first.deck.title);
    assert.equal(bare.deck.authorName, "");
  });
  const badTheme = await post(`/api/decks/${first.slug}/remix`, { theme: "evil" }).then(j);
  await t("invalid theme falls back to the source theme", () => assert.equal(badTheme.deck.theme, first.deck.theme));
  const xss = await post(`/api/decks/${first.slug}/remix`, { title: "<script>x</script>Hi", authorName: "<b>bad</b>" }).then(j);
  await t("remix strips angle brackets from title/author (XSS guard)", () => {
    assert.ok(!/[<>]/.test(xss.deck.title) && !/[<>]/.test(xss.deck.authorName));
  });
  await t("remix of a nonexistent deck → 404", async () =>
    assert.equal((await post("/api/decks/no-such-0000/remix", { theme: "space" })).status, 404));
  await t("remix path-traversal slug is rejected safely", async () => {
    const r = await post("/api/decks/..%2f..%2fetc/remix", {});
    assert.ok(r.status === 404 || r.status === 400);
  });

  console.log("\n4) The remixed deck is a real, independent, owned deck");
  const readRemix = await realFetch(`${base}/api/decks/${remix.slug}`).then(j);
  await t("remixed deck is readable on its own", () => assert.equal(readRemix.deck.slug, remix.slug));
  await t("GET of remixed deck never leaks its editKey", () => assert.equal(readRemix.deck.editKey, undefined));
  const renamed = await realFetch(`${base}/api/decks/${remix.slug}`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Renamed By Owner", editKey: remix.editKey }),
  }).then(j);
  await t("remix creator can rename with their editKey", () => assert.equal(renamed.deck.title, "Renamed By Owner"));
  await t("a stranger CANNOT rename the remixed deck", async () => {
    const r = await realFetch(`${base}/api/decks/${remix.slug}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Hacked", editKey: "wrong" }),
    });
    assert.equal(r.status, 403);
  });
  await t("editing the remix does NOT change the original", async () => {
    const orig = await realFetch(`${base}/api/decks/${first.slug}`).then(j);
    assert.notEqual(orig.deck.title, "Renamed By Owner");
  });

  console.log("\n5) Remix is rate-limited (abuse guard)");
  await t("many remixes from one IP eventually hit 429", async () => {
    let last;
    for (let i = 0; i < 42; i++) {
      last = await post(`/api/decks/${first.slug}/remix`, { theme: "space" }, { "x-forwarded-for": "7.7.7.7" });
    }
    assert.equal(last.status, 429);
  });

  console.log("\n6) Share page exposes the loop");
  const sharePage = await realFetch(`${base}/d/${first.slug}`).then((r) => r.text());
  await t('share page has a "Make one like this" button', () => assert.ok(/Make one like this/.test(sharePage)));
  await t("share page includes the remix panel + themes", () => assert.ok(/id="remix-panel"/.test(sharePage) && /id="remix-themes"/.test(sharePage)));
  await t("share page posts to the remix endpoint", () => assert.ok(/\/remix/.test(sharePage)));
  await t("share page still never contains any editKey", () => assert.ok(!sharePage.includes(remix.editKey) && !sharePage.includes(first.editKey || "NOPE")));

  console.log("\n7) Renderer handles a remixed deck (DOM)");
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<!doctype html><body><div id=root></div></body>", { runScripts: "outside-only" });
  dom.window.eval(fs.readFileSync(__dirname + "/../public/renderer.js", "utf8"));
  dom.window.eval(`renderDeck(${JSON.stringify(remix.deck)}, document.getElementById("root"))`);
  await t("remixed deck renders with its new theme + title", () => {
    const d = dom.window.document;
    assert.ok(d.querySelector(".deck.theme-candy"));
    assert.ok(d.querySelectorAll(".card").length >= 2);
  });

  console.log(`\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ${pass} passed, ${fail} failed\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  process.exit(fail ? 1 : 0);
})();
