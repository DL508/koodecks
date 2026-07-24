process.env.KOO_TEST_BYPASS_AUTH = "1";
// scripts/site-validate.js
// Six realistic end-to-end scenarios across the WHOLE English KooDeck site —
// every page a real user touches — with YouTube + Claude mocked at the network
// layer. This is the "walk every page and look for bugs" pass.
//
// Scenarios:
//   1. Cold visitor lands on "/" → every section, link, and example resolves
//   2. Teacher makes a deck at /app (full YouTube path) → share, image, OG, Classroom
//   3. Viewer remixes a shared deck, renames it; stranger blocked
//   4. Student plays the Daily Dash at /play → daily, packs, play, share a challenge
//   5. Friend opens the challenge link /c/:slug → accepts → lands in the game
//   6. Edge/abuse across pages: bad routes, bad link, XSS, inappropriate, rate limits
//
// Run with:  node scripts/site-validate.js

const assert = require("assert");
let pass = 0, fail = 0;
const log = [];
const t = (scn, name, fn) =>
  Promise.resolve().then(fn).then(
    () => { pass++; log.push(`  \u2714 [S${scn}] ${name}`); },
    (e) => { fail++; log.push(`  \u2718 [S${scn}] ${name} \u2192 ${e.message}`); }
  );

// ---------- network mock ----------
const SUB = {
  appropriate: true, topic: "Volcanoes",
  big_idea: "Volcanoes erupt when melted rock is pushed up to the surface.",
  hook: "Some mountains can explode!",
  key_points: [{ title: "Magma", detail: "Melted rock underground." }, { title: "Pressure", detail: "Gases push it up." }],
  steps: [], numbers: [{ value: "1000C", meaning: "how hot lava gets" }],
  vocab: [{ word: "magma", kid_definition: "melted rock underground" }],
  fun_fact: "There are volcanoes under the ocean.", takeaway: "Volcanoes are Earth letting off steam.",
  quiz: [{ q: "Magma outside is called?", a: "Lava." }, { q: "What builds up?", a: "Pressure." }],
};
const LAY = { headline: "Boom! How Volcanoes Work", subhead: "Why mountains explode", hero_emoji: "🌋",
  cards: [{ type: "big_idea", size: "xl", emoji: "💡", title: "" }, { type: "points", size: "lg", emoji: "🔑", title: "Key ideas" }, { type: "takeaway", size: "lg", emoji: "🎒", title: "" }] };
const TXT = Array.from({ length: 30 }, (_, i) => `<text start="${i*4}" dur="4">Volcanoes push molten rock to the surface part ${i}</text>`).join("");

const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("localhost") || u.includes("127.0.0.1")) return realFetch(url, opts);
  if (u.includes("api.anthropic.com")) {
    const body = JSON.parse(opts.body);
    const stage1 = String(body.messages[0].content).includes("Transcrip");
    if (stage1 && String(body.messages[0].content).includes("UNSAFE_MARKER")) return aiResp({ appropriate: false });
    return aiResp(stage1 ? SUB : LAY);
  }
  if (u.includes("youtube.com/oembed")) return plain({ title: "Volcanoes 101", author_name: "SciKids", thumbnail_url: "https://i.ytimg.com/vi/x/hq.jpg" });
  if (u.includes("youtubei/v1/player")) return plain({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: "https://www.youtube.com/api/timedtext?m=1", languageCode: "en" }] } } });
  if (u.includes("api/timedtext")) return new Response(`<?xml version="1.0"?><transcript>${TXT}</transcript>`, { status: 200, headers: { "content-type": "text/xml" } });
  if (u.includes("youtube.com/watch")) return new Response(`<html><script>var ytInitialPlayerResponse = ${JSON.stringify({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: "https://www.youtube.com/api/timedtext?m=1", languageCode: "en" }] } } })};</script>"playabilityStatus":</html>`, { status: 200, headers: { "content-type": "text/html" } });
  return new Response("not mocked", { status: 404 });
};
function aiResp(o) { return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(o) }] }), { status: 200, headers: { "content-type": "application/json" } }); }
function plain(o) { return new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } }); }

process.env.ANTHROPIC_API_KEY = "test-key";
process.env.PORT = "3981";
process.env.DATA_DIR = "/tmp/site-val-" + Date.now();
require("../server.js");

const B = "http://localhost:3981";
const get = (p, h) => realFetch(B + p, h ? { headers: h } : undefined);
const post = (p, body, h) => realFetch(B + p, { method: "POST", headers: { "content-type": "application/json", ...(h || {}) }, body: JSON.stringify(body) });

(async () => {
  await new Promise((r) => setTimeout(r, 850));

  // ===== S1: Cold visitor on the landing page =====
  const home = await (await get("/")).text();
  await t(1, "landing loads with hero, Daily Dash, and how-it-works", () => {
    assert.ok(/deck kids/i.test(home));
    assert.ok(/id="how"/.test(home));
    assert.ok(/id="play"/.test(home), "Daily Dash section present");
    // Redesign: the old "Save your spot" signup card and examples section are gone.
    assert.ok(!/id="signup"/.test(home) && !/Save your spot/.test(home), "signup card should be removed");
    assert.ok(!/See it in action/.test(home), "examples section should be removed");
  });
  await t(1, "landing promotes Daily Dash (nav + banner + footer)", () => {
    assert.ok((home.match(/href="\/play"/g) || []).length >= 2);
    assert.ok(/Daily Dash/.test(home));
  });
  await t(1, "example decks still resolve directly (even though not shown on the homepage)", async () => {
    for (const s of ["example-water-cycle", "example-fractions", "example-photosynthesis"]) {
      assert.equal((await get("/d/" + s)).status, 200, s);
    }
  });
  await t(1, "email signup endpoint still accepts a valid teacher email", async () => {
    const r = await post("/api/signups", { email: "teacher@school.edu", role: "teacher" });
    assert.equal(r.status, 200);
  });

  // ===== S2: Teacher makes a deck at /app =====
  const appHtml = await (await get("/app")).text();
  await t(2, "/app serves the maker with the paste form", () => assert.ok(/id="deck-form"/.test(appHtml)));
  let deck;
  await t(2, "deck created from a YouTube link (full transcript path)", async () => {
    const r = await post("/api/decks", { url: "https://youtu.be/dQw4w9WgXcQ", gradeBand: "35", theme: "jungle" });
    assert.equal(r.status, 200);
    deck = await r.json();
    assert.ok(deck.slug && deck.editKey && deck.deck.substance.big_idea);
  });
  await t(2, "share page renders with remix, Classroom, and safety note", async () => {
    const html = await (await get("/d/" + deck.slug)).text();
    assert.ok(/Make one like this/.test(html));
    assert.ok(/id="gc-btn"/.test(html) && /classroom\.js/.test(html));
    assert.ok(/double-check/i.test(html));
  });
  await t(2, "deck image is a valid 2160px PNG and OG points at it", async () => {
    const r = await get("/d/" + deck.slug + "/image.png");
    const b = Buffer.from(await r.arrayBuffer());
    assert.equal(b.slice(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(b.readUInt32BE(16), 2160);
    const html = await (await get("/d/" + deck.slug)).text();
    assert.ok(html.includes(`/d/${deck.slug}/image.png`) && /og:image/.test(html));
  });

  // ===== S3: Viewer remixes =====
  let remix;
  await t(3, "remix creates an owned copy with new identity + lineage", async () => {
    const r = await post("/api/decks/" + deck.slug + "/remix", { theme: "candy", title: "My version", authorName: "Sam" }, { "x-forwarded-for": "2.2.2.2" });
    assert.equal(r.status, 200);
    remix = await r.json();
    assert.ok(remix.slug !== deck.slug && remix.deck.remixedFrom === deck.slug && remix.deck.theme === "candy");
  });
  await t(3, "owner renames with editKey; stranger gets 403", async () => {
    const ok = await realFetch(B + "/api/decks/" + remix.slug, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Renamed", editKey: remix.editKey }) });
    assert.equal(ok.status, 200);
    const no = await realFetch(B + "/api/decks/" + remix.slug, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Hack", editKey: "wrong" }) });
    assert.equal(no.status, 403);
  });
  await t(3, "original deck unchanged and never leaks its editKey", async () => {
    const d = await (await get("/api/decks/" + deck.slug)).json();
    assert.notEqual(d.deck.title, "Renamed");
    assert.equal(d.deck.editKey, undefined);
  });

  // ===== S4: Student plays the Daily Dash =====
  const play = await (await get("/play")).text();
  await t(4, "/play serves the game with daily button + pack grid", () => {
    assert.ok(/id="daily-btn"/.test(play) && /id="pack-grid"/.test(play));
    assert.ok(/KooDeck/.test(play) && /href="\/app"/.test(play));
  });
  await t(4, "game assets load", async () => {
    assert.equal((await get("/dash.css")).status, 200);
    assert.equal((await get("/dash.js")).status, 200);
  });
  await t(4, "daily returns 5 questions with a valid answer index each", async () => {
    const d = await (await get("/api/daily")).json();
    assert.equal(d.questions.length, 5);
    d.questions.forEach((q) => assert.ok(q.a >= 0 && q.a < q.choices.length));
  });
  await t(4, "all 5 packs listed and each pack is fully fetchable", async () => {
    const { packs } = await (await get("/api/packs")).json();
    assert.equal(packs.length, 5);
    for (const p of packs) {
      const full = await (await get("/api/packs/" + p.id)).json();
      assert.equal(full.questions.length, 5, p.id);
    }
  });
  let challenge;
  await t(4, "player shares a score → challenge slug created", async () => {
    const r = await post("/api/challenges", { packId: "daily", name: "Ava", score: 610, emojiRow: "⚡🟩⚡🟥🟩" }, { "x-forwarded-for": "3.3.3.3" });
    assert.equal(r.status, 200);
    challenge = (await r.json()).slug;
    assert.ok(/^[a-z]+-[a-z]+-\d{4}$/.test(challenge));
  });

  // ===== S5: Friend opens the challenge link =====
  await t(5, "/c/:slug renders with the score, OG tags, and accept link", async () => {
    const html = await (await get("/c/" + challenge)).text();
    assert.ok(html.includes("Ava scored 610"));
    assert.ok(/property="og:title"/.test(html) && /og:description/.test(html));
    assert.ok(html.includes(challenge), "challenge slug should be embedded for the accept link");
    assert.ok(/\/play\?challenge=/.test(html), "accept-link builder should target /play");
  });
  await t(5, "the challenge is retrievable via API for the game to load", async () => {
    const { challenge: c } = await (await get("/api/challenges/" + challenge)).json();
    assert.equal(c.name, "Ava");
    assert.equal(c.score, 610);
  });
  await t(5, "a stale/bad challenge link shows the friendly 404", async () => {
    const r = await get("/c/none-none-0000");
    assert.equal(r.status, 404);
    assert.ok(/href="\/app"|href="\/play"|New deck|not found/i.test(await r.text()), "404 should offer a way back");
  });

  // ===== S6: Edge cases & abuse across pages =====
  await t(6, "unknown deck slug → 404", async () => assert.equal((await get("/d/ghost-ghost-0000")).status, 404));
  await t(6, "bad video link → helpful 400", async () => {
    const r = await post("/api/decks", { url: "https://vimeo.com/nope" }, { "x-forwarded-for": "4.4.4.1" });
    assert.equal(r.status, 400);
    assert.ok(/YouTube link/.test((await r.json()).error));
  });
  await t(6, "inappropriate video → 422 refusal", async () => {
    const long = "UNSAFE_MARKER not for school ".repeat(12);
    const r = await post("/api/decks", { pastedText: long }, { "x-forwarded-for": "4.4.4.2" });
    assert.equal(r.status, 422);
  });
  await t(6, "XSS stripped in remix title AND challenge name", async () => {
    const r1 = await post("/api/decks/" + deck.slug + "/remix", { title: "<script>alert(1)</script>Hi" }, { "x-forwarded-for": "4.4.4.3" });
    assert.ok(!/[<>]/.test((await r1.json()).deck.title));
    const r2 = await post("/api/challenges", { name: "<img src=x>Bad", score: 1, emojiRow: "🟩" }, { "x-forwarded-for": "4.4.4.3" });
    const { challenge: c } = await (await get("/api/challenges/" + (await r2.json()).slug)).json();
    assert.ok(!/[<>]/.test(c.name));
  });
  await t(6, "challenge emoji row rejects non-emoji, score clamps", async () => {
    const r = await post("/api/challenges", { name: "X", score: 99999999, emojiRow: "hack🟩" }, { "x-forwarded-for": "4.4.4.4" });
    const { challenge: c } = await (await get("/api/challenges/" + (await r.json()).slug)).json();
    assert.ok(/^[🟩🟨🟥⚡]+$/u.test(c.emojiRow) && c.score <= 9999);
  });
  await t(6, "deck rate limiter fires (9th in window)", async () => {
    const long = "Filler text long enough to pass the input gate. ".repeat(10);
    let last;
    for (let i = 0; i < 9; i++) last = await post("/api/decks", { pastedText: long }, { "x-forwarded-for": "4.9.9.9" });
    assert.equal(last.status, 429);
  });
  await t(6, "healthz still ok", async () => assert.equal(await (await get("/healthz")).text(), "ok"));

  console.log("\n" + log.join("\n"));
  console.log(`\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ${pass} passed, ${fail} failed  (6 scenarios)\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  process.exit(fail ? 1 : 0);
})();
