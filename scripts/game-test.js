// scripts/game-test.js
// Validates the Daily Dash subpage inside KooDeck: the /play page, the
// game APIs, daily determinism, the challenge loop with its share pages,
// security hygiene, and the landing-page integration.
//
// Run with:  node scripts/game-test.js

process.env.DATA_DIR = require("os").tmpdir() + "/brightdeck-game-" + Date.now();
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.PORT = "3961";

const assert = require("assert");

let pass = 0, fail = 0;
const t = (name, fn) =>
  Promise.resolve().then(fn).then(
    () => { pass++; console.log("  \u2714", name); },
    (e) => { fail++; console.log("  \u2718", name, "\u2192", e.message); }
  );

(async () => {
  const { PACKS, getPack } = require("../lib/packs");
  const { getDaily } = require("../lib/daily");

  console.log("\n1) Pack + daily engine (in-process)");
  await t("5 packs × 5 questions, each with 4 unique choices + valid answer", () => {
    assert.equal(PACKS.length, 5);
    PACKS.forEach((p) => p.questions.forEach((q) => {
      assert.equal(q.choices.length, 4, q.q);
      assert.equal(new Set(q.choices).size, 4, q.q);
      assert.ok(q.a >= 0 && q.a < 4 && q.fun.length > 8, q.q);
    }));
  });
  await t("daily is deterministic per date and answers survive shuffling", () => {
    assert.deepEqual(getDaily("2026-07-11"), getDaily("2026-07-11"));
    const daily = getDaily("2026-07-11");
    const pack = getPack(daily.packId);
    daily.questions.forEach((q) => {
      const orig = pack.questions.find((oq) => oq.q === q.q);
      assert.equal(q.choices[q.a], orig.choices[orig.a], q.q);
    });
  });

  console.log("\n2) The /play subpage over live HTTP");
  require("../server.js");
  await new Promise((r) => setTimeout(r, 700));
  const base = "http://localhost:3961";

  await t("GET /play serves the game subpage", async () => {
    const r = await fetch(base + "/play");
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(/Daily Dash/.test(html) && /id="daily-btn"/.test(html));
    assert.ok(/id="pack-grid"/.test(html), "pack picker missing");
    assert.ok(/KooDeck/.test(html), "should be KooDeck-branded");
    assert.ok(/href="\/app"/.test(html), "cross-promo to deck maker missing");
  });
  await t("game assets served (dash.css, dash.js)", async () => {
    assert.equal((await fetch(base + "/dash.css")).status, 200);
    assert.equal((await fetch(base + "/dash.js")).status, 200);
  });
  await t("GET /api/daily returns today's 5 questions", async () => {
    const d = await (await fetch(base + "/api/daily")).json();
    assert.equal(d.questions.length, 5);
    assert.ok(d.date && d.title && d.emoji);
  });
  await t("GET /api/packs lists 5; /api/packs/:id returns full pack; bad id 404s", async () => {
    const { packs } = await (await fetch(base + "/api/packs")).json();
    assert.equal(packs.length, 5);
    const p = await (await fetch(base + "/api/packs/space")).json();
    assert.equal(p.questions.length, 5);
    assert.equal((await fetch(base + "/api/packs/zzz")).status, 404);
  });

  console.log("\n3) Challenge loop");
  let slug;
  await t("POST /api/challenges → share slug", async () => {
    const r = await fetch(base + "/api/challenges", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ packId: "daily", name: "Maya", score: 540, emojiRow: "⚡🟩🟩🟥⚡" }),
    });
    assert.equal(r.status, 200);
    slug = (await r.json()).slug;
    assert.ok(/^[a-z]+-[a-z]+-\d{4}$/.test(slug), slug);
  });
  await t("share page /c/:slug renders, OG tags, accept → /play?challenge=", async () => {
    const html = await (await fetch(base + "/c/" + slug)).text();
    assert.ok(html.includes("Maya scored 540"));
    assert.ok(/property="og:title"/.test(html));
    assert.ok(html.includes("/play?challenge="), "accept link should target /play");
  });
  await t("unknown challenge → 404 page", async () => {
    assert.equal((await fetch(base + "/c/none-none-0000")).status, 404);
  });
  await t("XSS stripped; emoji row sanitized; score clamped", async () => {
    const r = await fetch(base + "/api/challenges", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "7.7.7.7" },
      body: JSON.stringify({ packId: "space", name: "<script>x</script>Evil", score: 999999, emojiRow: "🟩<img>🟥" }),
    });
    const { slug: s2 } = await r.json();
    const { challenge } = await (await fetch(base + "/api/challenges/" + s2)).json();
    assert.ok(!/[<>]/.test(challenge.name));
    assert.ok(/^[🟩🟨🟥⚡]+$/u.test(challenge.emojiRow));
    assert.ok(challenge.score <= 9999);
    const html = await (await fetch(base + "/c/" + s2)).text();
    assert.ok(!html.includes("<script>x"));
  });
  await t("challenge rate limiter fires at 31 posts", async () => {
    let last;
    for (let i = 0; i < 31; i++) {
      last = await fetch(base + "/api/challenges", {
        method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "8.8.4.4" },
        body: JSON.stringify({ packId: "space", name: "Spam", score: 1, emojiRow: "🟩" }),
      });
    }
    assert.equal(last.status, 429);
  });

  console.log("\n4) Landing + site integration");
  await t("landing links to /play in nav, banner, and footer", async () => {
    const html = await (await fetch(base + "/")).text();
    const links = (html.match(/href="\/play"/g) || []).length;
    assert.ok(links >= 3, "expected ≥3 /play links, saw " + links);
    assert.ok(/Daily Dash/.test(html), "promo copy missing");
  });
  await t("deck features unaffected: seeded example + image still render", async () => {
    assert.equal((await fetch(base + "/d/example-water-cycle")).status, 200);
    assert.equal((await fetch(base + "/d/example-water-cycle/image.png")).status, 200);
  });
  await t("app page still served at /app", async () => {
    const html = await (await fetch(base + "/app")).text();
    assert.ok(/id="deck-form"/.test(html));
  });

  console.log(`\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ${pass} passed, ${fail} failed\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  process.exit(fail ? 1 : 0);
})();
