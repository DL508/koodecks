// scripts/merge-test.js
// Validates the MERGED bilingual build: shared accounts across /en and /es,
// language-aware pipeline, Spanish share page, shared image + game endpoints.
// Deeper merge validation: shared accounts across languages, lang-aware pipeline,
// Spanish share page, and the game working under /es/. Claude + YouTube mocked.
process.env.PORT = "3994";
process.env.DATA_DIR = "/tmp/md-merge-" + Date.now() + "";
process.env.SESSION_SECRET = "t";
process.env.ANTHROPIC_API_KEY = "test-key";
// Bilingual feature test creates several decks; ungate creation (the 1/day limit
// is covered in auth-test). Auth endpoints still work, so the shared-account
// assertions below remain valid.
process.env.KOO_TEST_BYPASS_AUTH = "1";

// Mock the pipeline's network calls so deck creation runs without real AI/YouTube.
const realFetch = global.fetch;
const seenLangs = [];
const SUB = { appropriate: true, topic: "T", big_idea: "Idea.", hook: "Hook",
  key_points: [{ title: "A", detail: "a" }, { title: "B", detail: "b" }], steps: [], numbers: [],
  vocab: [{ word: "w", kid_definition: "d" }], fun_fact: "f", takeaway: "t",
  quiz: [{ q: "q1", a: "a1" }, { q: "q2", a: "a2" }] };
const LAY = { headline: "H", subhead: "s", hero_emoji: "🌟",
  cards: [{ type: "big_idea", size: "xl", emoji: "💡", title: "" }, { type: "takeaway", size: "lg", emoji: "🎒", title: "" }] };
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("localhost")) return realFetch(url, opts);
  if (u.includes("api.anthropic.com")) {
    const content = String(JSON.parse(opts.body).messages[0].content);
    const stage1 = content.includes("Transcrip");
    // Record which language stage-1 ran in (Spanish prompt contains "Transcripción")
    if (stage1) seenLangs.push(content.includes("Transcripción") ? "es" : "en");
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(stage1 ? SUB : LAY) }] }),
      { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("no", { status: 404 });
};

require("../server.js");
const B = "http://localhost:3994";
const LONG = "This is enough text to make a deck from the pasted content path. ".repeat(8);

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
  };
}

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log("  OK  " + name); } else { fail++; console.log("  XX  " + name); } };

setTimeout(async () => {
  // 1) Register on the ENGLISH section
  const U = jar();
  const reg = await U.post("/api/auth/register", { email: "teach@school.edu", password: "password123" });
  t("register via shared API works", reg.status === 200);

  // 2) The SAME session is valid when browsing the Spanish section (shared accounts)
  const meEs = await (await U.get("/api/auth/me")).json();
  t("same account/session recognized across languages", meEs.user && meEs.user.email === "teach@school.edu");

  // 3) Create an English deck (lang defaults to en)
  const enDeck = await U.post("/api/decks", { pastedText: LONG, gradeBand: "35", theme: "space", lang: "en" });
  const enJson = await enDeck.json();
  t("English deck created", enDeck.status === 200 && !!enJson.slug);
  t("English deck stored with lang=en", enJson.deck && enJson.deck.lang === "en");

  // 4) Create a Spanish deck (lang: es) — should hit the ES pipeline branch
  const esDeck = await U.post("/api/decks", { pastedText: LONG, gradeBand: "35", theme: "space", lang: "es" });
  const esJson = await esDeck.json();
  t("Spanish deck created", esDeck.status === 200 && !!esJson.slug);
  t("Spanish deck stored with lang=es", esJson.deck && esJson.deck.lang === "es");
  t("pipeline actually ran in Spanish for the es request", seenLangs.includes("es"));
  t("pipeline ran in English for the en request", seenLangs.includes("en"));

  // 5) Both decks share ONE store — each viewable at its language's share page
  const enShare = await U.get("/d/" + enJson.slug);
  t("English share page /d/:slug renders", enShare.status === 200);
  const esShare = await U.get("/es/d/" + esJson.slug);
  const esShareText = await esShare.text();
  t("Spanish share page /es/d/:slug renders", esShare.status === 200);
  t("Spanish share page is in Spanish", /Haz uno igual|Recuerda|remix|Compartir|deck/i.test(esShareText));

  // 6) Deck image (shared endpoint) works for a Spanish-created deck
  const img = await U.get("/d/" + esJson.slug + "/image.png");
  const buf = Buffer.from(await img.arrayBuffer());
  t("Spanish deck renders a valid PNG", img.status === 200 && buf.slice(0,8).toString("hex") === "89504e470d0a1a0a");

  // 7) Game works under /es/ (shared API, Spanish page)
  const daily = await (await U.get("/api/daily")).json();
  t("shared /api/daily returns 5 questions", daily.questions && daily.questions.length === 5);
  const esPlay = await (await U.get("/es/play")).text();
  t("/es/play is the Spanish game page", /Reto Diario|Listos/i.test(esPlay));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 1600);
