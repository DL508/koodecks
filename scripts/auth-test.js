// scripts/auth-test.js
// Validates the account system and the freemium daily limit:
//   - registration + login + logout + session cookie round-trips
//   - password hashing (never stored in the clear) and wrong-password rejection
//   - the 3-decks/day free limit blocks the 4th, resets conceptually per day
//   - paid plan lifts the limit
//   - deck creation requires an account; remix stays account-less
//
// Run with:  node scripts/auth-test.js

process.env.DATA_DIR = require("os").tmpdir() + "/koodeck-auth-" + Date.now();
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.SESSION_SECRET = "test-secret-abc";
process.env.PORT = "3971";

const assert = require("assert");
const fs = require("fs");

let pass = 0, fail = 0;
const t = (name, fn) =>
  Promise.resolve().then(fn).then(
    () => { pass++; console.log("  \u2714", name); },
    (e) => { fail++; console.log("  \u2718", name, "\u2192", e.message); }
  );

// Mock Claude + YouTube so deck creation succeeds without network/AI.
const SUB = { appropriate: true, topic: "T", big_idea: "Big idea here about something.", hook: "Hook!",
  key_points: [{ title: "A", detail: "aa" }, { title: "B", detail: "bb" }], steps: [], numbers: [],
  vocab: [{ word: "w", kid_definition: "d" }], fun_fact: "ff", takeaway: "tt",
  quiz: [{ q: "q1", a: "a1" }, { q: "q2", a: "a2" }] };
const LAY = { headline: "Head", subhead: "sub", hero_emoji: "🌟",
  cards: [{ type: "big_idea", size: "xl", emoji: "💡", title: "" }, { type: "takeaway", size: "lg", emoji: "🎒", title: "" }] };
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("localhost")) return realFetch(url, opts);
  if (u.includes("api.anthropic.com")) {
    const stage1 = String(JSON.parse(opts.body).messages[0].content).includes("Transcrip");
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(stage1 ? SUB : LAY) }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("nope", { status: 404 });
};

const B = "http://localhost:3971";
// A tiny cookie jar so we can act like a logged-in browser.
function jar() {
  let cookie = "";
  return {
    async post(p, body) {
      const r = await realFetch(B + p, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
      const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      return r;
    },
    async get(p) { return realFetch(B + p, { headers: { cookie } }); },
    get cookie() { return cookie; },
    set cookie(c) { cookie = c; },
  };
}
const longText = "This is enough pasted text to pass the input gate for deck creation. ".repeat(8);

(async () => {
  const auth = require("../lib/auth");

  console.log("\n1) Unit: password hashing & sessions");
  await t("hashed password is not the plaintext and verifies", () => {
    const u = auth.createUser("unit@school.edu", "supersecret1");
    assert.ok(u.user, u.error);
    const rec = auth.getUser("unit@school.edu");
    assert.ok(!JSON.stringify(rec).includes("supersecret1"), "plaintext password stored!");
    assert.ok(auth.authenticate("unit@school.edu", "supersecret1"));
    assert.ok(!auth.authenticate("unit@school.edu", "wrongpass1"));
  });
  await t("free user starts with 3 decks remaining", () => {
    assert.equal(auth.remainingToday(auth.getUser("unit@school.edu")), 3);
  });
  await t("session cookie is signed & tamper-evident", () => {
    const c = auth.makeSessionCookie("unit@school.edu");
    const token = c.split(";")[0].replace("koo_session=", "");
    assert.ok(auth.userFromRequest({ headers: { cookie: "koo_session=" + token } }));
    // tamper with the value → rejected
    const bad = token.replace(/^./, "X");
    assert.equal(auth.userFromRequest({ headers: { cookie: "koo_session=" + bad } }), null);
  });

  console.log("\n2) HTTP: register / login / logout");
  require("../server.js");
  await new Promise((r) => setTimeout(r, 700));
  const A = jar();
  await t("register returns a session and public user", async () => {
    const r = await A.post("/api/auth/register", { email: "teacher@school.edu", password: "password123" });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.user.email, "teacher@school.edu");
    assert.equal(d.user.plan, "free");
    assert.ok(A.cookie.includes("koo_session="));
  });
  await t("duplicate registration is rejected", async () => {
    const r = await realFetch(B + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "teacher@school.edu", password: "password123" }) });
    assert.equal(r.status, 400);
  });
  await t("short password rejected", async () => {
    const r = await realFetch(B + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "x@y.com", password: "short" }) });
    assert.equal(r.status, 400);
  });
  await t("/api/auth/me reflects the logged-in user", async () => {
    const d = await (await A.get("/api/auth/me")).json();
    assert.equal(d.user.email, "teacher@school.edu");
  });
  await t("wrong password → 401", async () => {
    const r = await realFetch(B + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "teacher@school.edu", password: "nope" }) });
    assert.equal(r.status, 401);
  });

  console.log("\n3) Freemium: the 3-decks/day limit");
  await t("deck creation WITHOUT an account now succeeds (students create free)", async () => {
    // Item 6: students can create without an account (bounded by a per-IP daily cap).
    const r = await realFetch(B + "/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pastedText: longText }) });
    assert.equal(r.status, 200, "anonymous creation should succeed, got " + r.status);
    const d = await r.json();
    assert.ok(d.slug, "should return a deck slug");
    assert.equal(d.deck.ownerEmail, null, "anonymous deck has no owner");
  });
  await t("free user can make 3 decks", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await A.post("/api/decks", { pastedText: longText, gradeBand: "35", theme: "space" });
      assert.equal(r.status, 200, "deck " + (i + 1) + " failed");
    }
  });
  await t("the 4th deck is blocked with needsUpgrade (402)", async () => {
    const r = await A.post("/api/decks", { pastedText: longText });
    assert.equal(r.status, 402);
    const d = await r.json();
    assert.equal(d.needsUpgrade, true);
    assert.ok(/free decks/i.test(d.error));
  });
  await t("/api/auth/me now shows 0 remaining", async () => {
    const d = await (await A.get("/api/auth/me")).json();
    assert.equal(d.user.remainingToday, 0);
  });

  console.log("\n4) Paid plan lifts the limit");
  await t("after upgrade to paid, deck creation works again", async () => {
    auth.setPlan("teacher@school.edu", "paid", null);
    const r = await A.post("/api/decks", { pastedText: longText });
    assert.equal(r.status, 200);
    const d = await (await A.get("/api/auth/me")).json();
    assert.equal(d.user.plan, "paid");
  });

  console.log("\n5) Remix stays account-less (viral loop preserved)");
  let sharedSlug;
  await t("make a deck to remix from (as paid user)", async () => {
    const r = await A.post("/api/decks", { pastedText: longText });
    sharedSlug = (await r.json()).slug;
    assert.ok(sharedSlug);
  });
  await t("a logged-OUT visitor can remix without an account", async () => {
    const r = await realFetch(B + "/api/decks/" + sharedSlug + "/remix", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: "candy", title: "Mine", authorName: "Kid" }),
    });
    assert.equal(r.status, 200, "remix should not require an account");
  });

  console.log("\n6) Logout");
  await t("logout clears the session", async () => {
    await A.post("/api/auth/logout", {});
    A.cookie = "koo_session=; "; // browser would drop it
    const d = await (await A.get("/api/auth/me")).json();
    assert.equal(d.user, null);
  });

  console.log("\n7) Auth pages served");
  for (const [p, needle] of [["/login", "Log in"], ["/signup", "Log in"], ["/pricing", "pricing"], ["/account", "account"]]) {
    await t(`GET ${p} serves a page`, async () => {
      const r = await realFetch(B + p);
      assert.equal(r.status, 200);
      assert.ok((await r.text()).toLowerCase().includes(needle.toLowerCase()));
    });
  }
  await t("pricing shows both price points ($19 yearly / $24.99 monthly)", async () => {
    const html = await (await realFetch(B + "/pricing")).text();
    assert.ok(html.includes("$19") && html.includes("$24.99"));
  });

  console.log(`\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ${pass} passed, ${fail} failed\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  process.exit(fail ? 1 : 0);
})();
