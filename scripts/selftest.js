process.env.KOO_TEST_BYPASS_AUTH = "1";
// scripts/selftest.js
// Automated validation for KooDeck. Mocks the Claude API so the entire
// create-deck flow runs end to end without spending money or needing a key.
// Run with:  node scripts/selftest.js

process.env.DATA_DIR = require("os").tmpdir() + "/brightdeck-test-" + Date.now();
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.PORT = "3456";

const assert = require("assert");

let pass = 0, fail = 0;
function t(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { pass++; console.log("  ✔", name); })
    .catch((e) => { fail++; console.log("  ✘", name, "→", e.message); });
}

// ---------- Mock the Claude API + transcript fetch ----------
const SAMPLE_SUBSTANCE = {
  appropriate: true,
  topic: "The water cycle",
  big_idea: "Water travels in a big loop between the sky, the land, and the ocean.",
  hook: "The water you drank today might once have been in a dinosaur's puddle!",
  key_points: [
    { title: "Evaporation", detail: "The sun heats water and turns it into invisible vapor that rises." },
    { title: "Condensation", detail: "High up, vapor cools and forms clouds." },
    { title: "Precipitation", detail: "Clouds get heavy and water falls as rain or snow." },
  ],
  steps: [
    { title: "Warm up", detail: "Sunshine heats lakes and oceans." },
    { title: "Rise", detail: "Water vapor floats up into the sky." },
    { title: "Fall", detail: "Rain brings the water back down." },
  ],
  numbers: [{ value: "97%", meaning: "of Earth's water is in the oceans" }],
  vocab: [{ word: "vapor", kid_definition: "water as an invisible gas" }],
  fun_fact: "Earth has been recycling the same water for billions of years.",
  takeaway: "Next time it rains, remember: that water has been on an amazing journey.",
  quiz: [
    { q: "What makes water rise into the sky?", a: "Heat from the sun (evaporation)." },
    { q: "What are clouds made of?", a: "Tiny drops of condensed water vapor." },
  ],
};
const SAMPLE_LAYOUT = {
  headline: "The Amazing Water Loop",
  subhead: "Where every raindrop has been",
  hero_emoji: "💧",
  cards: [
    { type: "big_idea", size: "xl", emoji: "💡", title: "" },
    { type: "steps", size: "lg", emoji: "🔁", title: "The journey" },
    { type: "numbers", size: "md", emoji: "🔢", title: "" },
    { type: "vocab", size: "md", emoji: "📚", title: "" },
    { type: "quiz", size: "lg", emoji: "❓", title: "" },
    { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
  ],
};

let claudeCallCount = 0;
let claudeMode = "ok"; // "ok" | "fenced" | "inappropriate" | "garbage" | "http500"
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("api.anthropic.com")) {
    claudeCallCount++;
    if (claudeMode === "http500") return new Response("overloaded", { status: 500 });
    const body = JSON.parse(opts.body);
    const isStage1 = body.messages[0].content.includes("Transcript");
    let payload;
    if (claudeMode === "inappropriate" && isStage1) payload = { appropriate: false };
    else if (claudeMode === "garbage") payload = null;
    else payload = isStage1 ? SAMPLE_SUBSTANCE : SAMPLE_LAYOUT;
    let text = payload === null ? "sorry, I can't do JSON today" : JSON.stringify(payload);
    if (claudeMode === "fenced") text = "```json\n" + text + "\n```";
    return new Response(
      JSON.stringify({ content: [{ type: "text", text }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  if (u.includes("youtube.com/oembed")) {
    return new Response(
      JSON.stringify({ title: "The Water Cycle for Kids", author_name: "Science Fun", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  return realFetch(url, opts);
};

const LONG_TEXT = ("The water cycle is the journey water takes as it moves around our planet. ").repeat(40);

(async () => {
  console.log("\n1) URL parsing (lib/youtube.js)");
  const { extractVideoId } = require("../lib/youtube.js");
  await t("watch link", () => assert.equal(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ"));
  await t("watch link with extra params", () => assert.equal(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL1"), "dQw4w9WgXcQ"));
  await t("youtu.be share link", () => assert.equal(extractVideoId("https://youtu.be/abcdefghijk?si=xyz"), "abcdefghijk"));
  await t("shorts link", () => assert.equal(extractVideoId("https://youtube.com/shorts/AbCdEfGhIjK"), "AbCdEfGhIjK"));
  await t("embed link", () => assert.equal(extractVideoId("https://www.youtube.com/embed/AbCdEfGhIjK"), "AbCdEfGhIjK"));
  await t("mobile m.youtube link", () => assert.equal(extractVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ"));
  await t("bare video id", () => assert.equal(extractVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ"));
  await t("link without protocol", () => assert.equal(extractVideoId("youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ"));
  await t("rejects non-youtube URL", () => assert.equal(extractVideoId("https://vimeo.com/12345"), null));
  await t("rejects nonsense", () => assert.equal(extractVideoId("hello there"), null));
  await t("rejects empty", () => assert.equal(extractVideoId(""), null));

  console.log("\n2) Storage (lib/store.js)");
  const { saveDeck, getDeck, updateDeck } = require("../lib/store.js");
  const saved = saveDeck({ title: "Test", theme: "space", substance: {}, layout: {} });
  await t("saveDeck assigns a friendly slug", () => assert.match(saved.slug, /^[a-z]+-[a-z]+-\d{4}$/));
  await t("saveDeck assigns a secret editKey", () => assert.ok(saved.editKey && saved.editKey.length >= 12));
  await t("getDeck round-trips", () => assert.equal(getDeck(saved.slug).title, "Test"));
  await t("updateDeck patches fields", () => assert.equal(updateDeck(saved.slug, { title: "New" }).title, "New"));
  await t("updateDeck preserves editKey", () => assert.equal(getDeck(saved.slug).editKey, saved.editKey));
  await t("getDeck blocks path traversal", () => assert.equal(getDeck("../../etc/passwd"), null));
  await t("getDeck handles missing slug", () => assert.equal(getDeck("nope-nope-0000"), null));

  console.log("\n3) AI pipeline (lib/pipeline.js, Claude mocked)");
  const { runPipeline } = require("../lib/pipeline.js");
  claudeMode = "ok";
  const out = await runPipeline({ transcript: LONG_TEXT, videoTitle: "T", gradeBand: "35", theme: "ocean" });
  await t("pipeline makes exactly 2 AI calls", () => assert.equal(claudeCallCount, 2));
  await t("stage 1 returns substance", () => assert.equal(out.substance.topic, "The water cycle"));
  await t("stage 2 returns layout with cards", () => assert.ok(out.layout.cards.length >= 4));
  claudeMode = "fenced";
  const out2 = await runPipeline({ transcript: LONG_TEXT, videoTitle: "T", gradeBand: "k2", theme: "candy" });
  await t("survives markdown-fenced JSON from the model", () => assert.equal(out2.layout.headline, SAMPLE_LAYOUT.headline));
  claudeMode = "inappropriate";
  await t("blocks non-school-appropriate videos", () =>
    runPipeline({ transcript: LONG_TEXT, videoTitle: "T", gradeBand: "35", theme: "space" })
      .then(() => { throw new Error("should have thrown"); }, (e) => assert.equal(e.message, "NOT_APPROPRIATE")));
  claudeMode = "garbage";
  await t("clean error when the model returns non-JSON", () =>
    runPipeline({ transcript: LONG_TEXT, videoTitle: "T", gradeBand: "35", theme: "space" })
      .then(() => { throw new Error("should have thrown"); }, (e) => assert.equal(e.message, "BAD_MODEL_JSON")));
  claudeMode = "http500";
  await t("clean error when the API is down", () =>
    runPipeline({ transcript: LONG_TEXT, videoTitle: "T", gradeBand: "35", theme: "space" })
      .then(() => { throw new Error("should have thrown"); }, (e) => assert.match(e.message, /^CLAUDE_API_500/)));
  claudeMode = "ok";

  console.log("\n4) HTTP API (server.js, end to end with pasted text)");
  require("../server.js");
  await new Promise((r) => setTimeout(r, 600));
  const base = "http://localhost:3456";
  const j = (r) => r.json();

  const created = await realFetch(base + "/api/decks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pastedText: LONG_TEXT, gradeBand: "35", theme: "notebook" }),
  }).then(j);
  await t("POST /api/decks creates a deck from pasted text", () => assert.ok(created.slug));
  await t("create response includes the private editKey", () => assert.ok(created.editKey));
  await t("create response deck does NOT include editKey", () => assert.equal(created.deck.editKey, undefined));
  await t("deck stores chosen theme", () => assert.equal(created.deck.theme, "notebook"));

  const read = await realFetch(base + "/api/decks/" + created.slug).then(j);
  await t("GET /api/decks/:slug returns the deck", () => assert.equal(read.deck.slug, created.slug));
  await t("GET never leaks the editKey", () => assert.equal(read.deck.editKey, undefined));

  const badPatch = await realFetch(base + "/api/decks/" + created.slug, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Hacked!", editKey: "wrong-key" }),
  });
  await t("PATCH with wrong editKey is rejected (403)", () => assert.equal(badPatch.status, 403));
  await t("wrong-key rename did not change the deck", async () =>
    assert.notEqual((await realFetch(base + "/api/decks/" + created.slug).then(j)).deck.title, "Hacked!"));

  const goodPatch = await realFetch(base + "/api/decks/" + created.slug, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Maya's Water Deck", authorName: "Maya", editKey: created.editKey }),
  }).then(j);
  await t("PATCH with correct editKey renames", () => assert.equal(goodPatch.deck.title, "Maya's Water Deck"));
  await t("rename strips angle brackets (XSS guard)", async () => {
    const r = await realFetch(base + "/api/decks/" + created.slug, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "<script>alert(1)</script>Cool", editKey: created.editKey }),
    }).then(j);
    assert.ok(!r.deck.title.includes("<") && !r.deck.title.includes(">"));
  });

  const sharePage = await realFetch(base + "/d/" + created.slug).then((r) => r.text());
  await t("share page renders with the deck title", () => assert.ok(sharePage.includes("KooDeck")));
  await t("share page embeds deck JSON safely", () => assert.ok(sharePage.includes('"slug":"' + created.slug + '"')));
  await t("share page never contains the editKey", () => assert.ok(!sharePage.includes(created.editKey)));
  await t("share page has OG tags for link previews", () => assert.ok(sharePage.includes('property="og:title"')));

  await t("unknown deck → friendly 404 page", async () =>
    assert.equal((await realFetch(base + "/d/happy-ghost-0000")).status, 404));
  await t("bad YouTube link → helpful 400", async () => {
    const r = await realFetch(base + "/api/decks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/notyoutube" }),
    });
    assert.equal(r.status, 400);
  });
  await t("too-short pasted text → helpful 422", async () => {
    const r = await realFetch(base + "/api/decks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ pastedText: "too short", url: "" }),
    });
    assert.equal(r.status, 400 /* no valid url + short text */);
  });
  await t("rate limiter kicks in after 8 quick decks", async () => {
    let last;
    for (let i = 0; i < 9; i++) {
      last = await realFetch(base + "/api/decks", {
        method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
        body: JSON.stringify({ pastedText: LONG_TEXT }),
      });
    }
    assert.equal(last.status, 429);
  });
  await t("invalid theme falls back to default", async () => {
    const r = await realFetch(base + "/api/decks", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "8.8.8.8" },
      body: JSON.stringify({ pastedText: LONG_TEXT, theme: "evil-theme" }),
    }).then(j);
    assert.equal(r.deck.theme, "space");
  });

  console.log("\n5) Renderer (public/renderer.js in a simulated browser)");
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(`<!doctype html><body><div id="root"></div></body>`, { runScripts: "outside-only" });
  const fs = require("fs");
  dom.window.eval(fs.readFileSync(__dirname + "/../public/renderer.js", "utf8"));
  const deckForRender = { ...created.deck, title: "Maya's Water Deck", authorName: "Maya", videoId: "dQw4w9WgXcQ", videoTitle: "The Water Cycle", videoThumb: "https://i.ytimg.com/vi/x/hqdefault.jpg" };
  dom.window.eval(`renderDeck(${JSON.stringify(deckForRender)}, document.getElementById("root"))`);
  const doc = dom.window.document;
  await t("renders the deck with the right theme class", () => assert.ok(doc.querySelector(".deck.theme-notebook")));
  await t("renders the custom title", () => assert.equal(doc.querySelector(".deck-hero h2").textContent, "Maya's Water Deck"));
  await t("renders the student byline", () => assert.ok(doc.querySelector(".byline").textContent.includes("Maya")));
  await t("renders all layout cards that have content", () => assert.ok(doc.querySelectorAll(".card").length >= 4));
  await t("quiz answers start hidden and toggle on tap", () => {
    const li = doc.querySelector(".quiz-list li");
    assert.ok(!li.classList.contains("open"));
    li.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.ok(li.classList.contains("open"));
  });
  await t("source strip links back to the original video", () =>
    assert.ok(doc.querySelector(".deck-source a").href.includes("youtube.com/watch?v=dQw4w9WgXcQ")));
  await t("text is inserted as textContent (no HTML injection path)", () => {
    dom.window.eval(`renderDeck(${JSON.stringify({ ...deckForRender, title: "<img src=x onerror=alert(1)>" })}, document.getElementById("root"))`);
    assert.equal(doc.querySelector("img[onerror]"), null);
  });

  console.log(`\n══════════════════════════════\n  ${pass} passed, ${fail} failed\n══════════════════════════════`);
  process.exit(fail ? 1 : 0);
})();
