process.env.PORT = "3997";
process.env.DATA_DIR = "/tmp/feature-" + Date.now();
process.env.SESSION_SECRET = "t";
process.env.ANTHROPIC_API_KEY = "test-key";

const realFetch = global.fetch;
const SUB = { appropriate: true, topic: "Volcanoes", big_idea: "Big.", hook: "H",
  key_points: [{ title: "A", detail: "a" }], steps: [], numbers: [],
  vocab: [{ word: "magma", kid_definition: "d" }, { word: "lava", kid_definition: "d" }],
  fun_fact: "Cool fact.", takeaway: "t",
  quiz: [{ q: "Melted rock underground?", a: "Magma" }, { q: "Melted rock above ground?", a: "Lava" },
         { q: "Builds up before eruption?", a: "Pressure" }, { q: "Hottest?", a: "1000C" }] };
const LAY = { headline: "Volcanoes 101", subhead: "s", hero_emoji: "🌋",
  cards: [{ type: "big_idea", size: "xl", emoji: "💡", title: "" }] };
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("localhost")) return realFetch(url, opts);
  if (u.includes("api.anthropic.com")) {
    const stage1 = String(JSON.parse(opts.body).messages[0].content).includes("Transcrip");
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(stage1 ? SUB : LAY) }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("no", { status: 404 });
};

require("../server.js");
const B = "http://localhost:3997";
const LONG = "A volcano erupts when magma rises to the surface again and again over time. ".repeat(6);
let pass = 0, fail = 0;
const t = (n, c) => { if (c) { pass++; console.log("  OK  " + n); } else { fail++; console.log("  XX  " + n); } };

function jar() {
  let cookie = "";
  return {
    async post(p, b) { const r = await realFetch(B + p, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(b) }); const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0]; return r; },
    async get(p) { return realFetch(B + p, { headers: { cookie } }); },
  };
}

setTimeout(async () => {
  // 1) STUDENT (no account) can create a deck for free
  const anon = await realFetch(B + "/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pastedText: LONG, lang: "en" }) });
  const anonJson = await anon.json();
  t("student (no account) can create a deck", anon.status === 200 && !!anonJson.slug);
  t("student deck has no owner (ownerEmail null)", anonJson.deck && anonJson.deck.ownerEmail === null);
  const anonSlug = anonJson.slug, anonKey = anonJson.editKey;

  // 2) Anonymous per-IP daily cap (ANON_DAILY_LIMIT = 3): 2 more ok, 4th blocked
  await realFetch(B + "/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pastedText: LONG }) });
  await realFetch(B + "/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pastedText: LONG }) });
  const fourth = await realFetch(B + "/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pastedText: LONG }) });
  t("anonymous 4th deck blocked by per-IP cap (402)", fourth.status === 402);

  // 3) Today's decks listing includes the student decks
  const today = await (await realFetch(B + "/api/decks/today")).json();
  t("today's-decks listing returns created decks", Array.isArray(today.decks) && today.decks.length >= 3);
  t("today listing carries title + heroEmoji", today.decks[0].title === "Volcanoes 101" && today.decks[0].heroEmoji === "🌋");

  // 4) Registered user: their decks are found by owner
  const U = jar();
  await U.post("/api/auth/register", { email: "teach@school.edu", password: "password123" });
  const mine0 = await (await U.get("/api/my/decks")).json();
  t("new user has 0 decks", mine0.decks && mine0.decks.length === 0);
  const myDeck = await (await U.post("/api/decks", { pastedText: LONG, lang: "en" })).json();
  const mine1 = await (await U.get("/api/my/decks")).json();
  t("registered user finds their own created deck", mine1.decks.length === 1 && mine1.decks[0].slug === myDeck.slug);
  t("my-decks requires login (401 when logged out)", (await realFetch(B + "/api/my/decks")).status === 401);

  // 5) Convert a deck to a Dash (item 2) using the editKey
  const toDash = await realFetch(B + "/api/decks/" + anonSlug + "/to-dash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ editKey: anonKey }) });
  const tdJson = await toDash.json();
  t("deck converts to a Dash with editKey", toDash.status === 200 && tdJson.ok);
  t("converted dash has questions", tdJson.questions >= 3);
  t("wrong editKey cannot convert (403)", (await realFetch(B + "/api/decks/" + anonSlug + "/to-dash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ editKey: "wrong" }) })).status === 403);

  // 6) The dash is playable and appears in the all-dashes listing
  const play = await (await realFetch(B + "/api/dash/" + anonSlug)).json();
  t("community dash is playable (has pack with questions)", play.pack && play.pack.questions.length >= 3);
  t("dash questions have exactly 4 choices + valid answer index", play.pack.questions.every((q) => q.choices.length === 4 && q.a >= 0 && q.a < 4));
  t("correct answer is among the choices", play.pack.questions.every((q) => q.choices[q.a] && q.choices[q.a].length > 0));
  const dashes = await (await realFetch(B + "/api/dashes")).json();
  t("all-dashes listing includes the converted dash", dashes.dashes.some((d) => d.slug === anonSlug && d.isDash));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 1500);
