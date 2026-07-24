// server.js
// KooDeck — paste a YouTube link, get a kid-friendly infographic deck.
// One small server does everything: the API, the app, and the share pages.

const path = require("path");
const fs = require("fs");
const express = require("express");
const { extractVideoId, fetchVideoMeta, fetchTranscript } = require("./lib/youtube");
const { runPipeline, GRADE_BANDS } = require("./lib/pipeline");
const { saveDeck, getDeck, updateDeck, decksToday, decksByOwner, allDashes } = require("./lib/store");
const { buildDeckSvg, renderPng } = require("./lib/image");
const { seedExamples } = require("./lib/examples");
const { getPack, listPacks } = require("./lib/packs");
const { getDaily, todayStr } = require("./lib/daily");
const { saveChallenge, getChallenge } = require("./lib/challenges");
const { securityHeaders, getClientIp, honeypotHit, verifyTurnstile, turnstileEnabled } = require("./lib/security");
const auth = require("./lib/auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(securityHeaders);
app.use(express.json({ limit: "1mb" }));

// Allow the Chrome extension (and other clients) to call the API cross-origin.
// The API only creates/reads public decks, so an open policy is fine here; the
// rate limiter still protects the AI budget. Static files don't need this.
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, "public"), { index: false, redirect: false }));

// Landing page is the front door; the deck-maker app lives at /app.
// NOTE: the merged build serves both languages on ONE domain (/ and /es/), so the
// language switcher uses fixed same-domain links — it no longer needs ALTERNATE_SITE_URL.
// ALT_URL only fills a now-inert {{ALT_URL}} placeholder for backward template compat.
// (Legacy note: ALTERNATE_SITE_URL previously pointed at a separate sister site,
// e.g. your Spanish deployment). If unset, the switcher hides itself.
const ALT_URL = /^https?:\/\//.test(process.env.ALTERNATE_SITE_URL || "") ? process.env.ALTERNATE_SITE_URL.replace(/\/+$/, "") : "";
const TS_KEY = process.env.TURNSTILE_SITE_KEY || "";
const landingHtml = fs.readFileSync(path.join(__dirname, "public", "landing.html"), "utf8")
  .replaceAll("{{ALT_URL}}", ALT_URL).replaceAll("{{TS_KEY}}", TS_KEY);
const appHtml = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8")
  .replaceAll("{{TS_KEY}}", TS_KEY);
// login/signup pages carry the Turnstile widget, so they MUST get {{TS_KEY}} filled
// (serving the raw file left the placeholder unreplaced and the widget never rendered).
const loginHtml = fs.readFileSync(path.join(__dirname, "public", "login.html"), "utf8")
  .replaceAll("{{TS_KEY}}", TS_KEY);
const resetHtml = fs.readFileSync(path.join(__dirname, "public", "reset.html"), "utf8")
  .replaceAll("{{TS_KEY}}", TS_KEY);
app.get("/", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(landingHtml); });
app.get("/app", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(appHtml); });

// ---------- Spanish section (served at /es/*, shares the same backend) ----------
const esLandingHtml = fs.readFileSync(path.join(__dirname, "public", "es", "landing.html"), "utf8")
  .replaceAll("{{ALT_URL}}", "").replaceAll("{{TS_KEY}}", TS_KEY);
const esAppHtml = fs.readFileSync(path.join(__dirname, "public", "es", "index.html"), "utf8")
  .replaceAll("{{TS_KEY}}", TS_KEY);
const esLoginHtml = fs.readFileSync(path.join(__dirname, "public", "es", "login.html"), "utf8")
  .replaceAll("{{TS_KEY}}", TS_KEY);
const esResetHtml = fs.readFileSync(path.join(__dirname, "public", "es", "reset.html"), "utf8")
  .replaceAll("{{TS_KEY}}", TS_KEY);
const sendEsLanding = (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(esLandingHtml); };
app.get("/es", sendEsLanding);
app.get("/es/", sendEsLanding);
app.get("/es/app", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(esAppHtml); });
app.get("/es/play", (_req, res) => res.sendFile(path.join(__dirname, "public", "es", "play.html")));
app.get("/es/login", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(esLoginHtml); });
app.get("/es/signup", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(esLoginHtml); });
app.get("/es/reset", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(esResetHtml); });
app.get("/es/pricing", (_req, res) => res.sendFile(path.join(__dirname, "public", "es", "pricing.html")));
app.get("/es/account", (_req, res) => res.sendFile(path.join(__dirname, "public", "es", "account.html")));
// Daily Dash game subpage.
app.get("/play", (_req, res) => res.sendFile(path.join(__dirname, "public", "play.html")));

// Very light rate limit so one visitor can't drain your AI budget.
const hits = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    const fresh = list.filter((t) => now - t < RATE_WINDOW_MS);
    if (fresh.length) hits.set(ip, fresh);
    else hits.delete(ip);
  }
}, RATE_WINDOW_MS).unref();
function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= 8) {
    return res.status(429).json({
      error: "Whoa, speedy! You've made a lot of decks in a row. Take a 10-minute break and try again.",
    });
  }
  list.push(now);
  hits.set(ip, list);
  next();
}

const THEMES = ["space", "ocean", "jungle", "candy", "comic", "notebook"];

// Substance cache: the AI extraction/design for a given video at a given grade
// band is identical no matter who asks, so we cache it. The SECOND person to
// deck a popular video (at the same level) skips both AI calls entirely — the
// content just gets re-skinned with their chosen theme at render time. Popular
// videos therefore get *cheaper* to deck the more they spread.
const substanceCache = new Map(); // key: `${videoId}::${gradeBand}` -> { substance, layout }
const SUBSTANCE_CACHE_MAX = 500;
function cacheKey(videoId, gradeBand, lang) {
  return videoId ? `${videoId}::${gradeBand}::${lang || "en"}` : null;
}
function cacheGet(videoId, gradeBand, lang) {
  const k = cacheKey(videoId, gradeBand, lang);
  return k ? substanceCache.get(k) || null : null;
}
function cacheSet(videoId, gradeBand, lang, value) {
  const k = cacheKey(videoId, gradeBand, lang);
  if (!k) return;
  if (substanceCache.size >= SUBSTANCE_CACHE_MAX) {
    substanceCache.delete(substanceCache.keys().next().value); // evict oldest
  }
  substanceCache.set(k, value);
}

// ---------- API: create a deck ----------
app.post("/api/decks", rateLimit, async (req, res) => {
  try {
    // Bot protection: invisible honeypot + (if configured) Cloudflare Turnstile.
    if (honeypotHit(req.body)) return res.status(400).json({ error: "Something went wrong. Please try again." });

    // Deck creation (the AI-cost action) requires a free or paid ACCOUNT.
    // Only registered teachers/parents can create: free accounts get
    // FREE_DAILY_LIMIT decks per day, paid accounts are unlimited. Students and
    // viewers never create — they open shared deck links and can remix (zero-AI)
    // without an account. KOO_TEST_BYPASS_AUTH is ONLY set by the test suites.
    const testBypass = process.env.KOO_TEST_BYPASS_AUTH === "1";
    const currentUser = testBypass ? null : auth.userFromRequest(req);
    if (!testBypass) {
      if (!currentUser) {
        return res.status(401).json({ error: "Please create a free account or log in to make decks.", needsAuth: true });
      }
      if (!auth.canCreate(currentUser)) {
        return res.status(402).json({
          error: `You've used your free deck for today. Upgrade for unlimited decks, or come back tomorrow!`,
          needsUpgrade: true,
        });
      }
    }

    const { url, gradeBand = "35", theme = "space", pastedText = "", lang = "en" } = req.body || {};
    const chosenTheme = THEMES.includes(theme) ? theme : "space";
    const deckLang = lang === "es" ? "es" : "en";

    let videoId = null;
    let meta = { title: "My video", author: "", thumbnail: "" };
    let transcriptText = "";

    if (pastedText && pastedText.trim().length > 200) {
      // Fallback path: student pasted the transcript or their notes directly.
      transcriptText = pastedText.trim().slice(0, 120000);
      if (url) {
        videoId = extractVideoId(url);
        if (videoId) meta = await fetchVideoMeta(videoId);
      }
    } else {
      videoId = extractVideoId(url);
      if (!videoId) {
        return res.status(400).json({
          error: "That doesn't look like a YouTube link. Copy the link from YouTube's Share button and try again.",
        });
      }
      meta = await fetchVideoMeta(videoId);
      try {
        transcriptText = await fetchTranscript(videoId, deckLang);
      } catch (err) {
        if (err.message === "NO_CAPTIONS") {
          return res.status(422).json({
            error: "This video doesn't have captions available, so we can't read it. Try another video that has captions/subtitles — or open the video's transcript on YouTube, copy it, and paste it into the 'Paste text instead' box.",
            code: "NO_CAPTIONS",
          });
        }
        // Transient/technical failure — NOT the same as "no captions".
        console.error("transcript fetch failed:", videoId, err.detail || err.message);
        return res.status(502).json({
          error: "We couldn't read this video's captions right now (that can happen when YouTube is being fussy). Please try again in a moment, or paste the transcript text instead.",
          code: "TRANSCRIPT_FETCH_FAILED",
        });
      }
    }

    if (transcriptText.length < 200) {
      return res.status(422).json({ error: "That video is too short to make a deck from. Try one with more talking in it!" });
    }

    const band = GRADE_BANDS[gradeBand] ? gradeBand : "35";

    // Reuse cached substance/layout for this video+level if we've seen it before
    // (zero AI). Only the theme (a render-time CSS skin) differs between users.
    let substance, layout;
    const cached = cacheGet(videoId, band, deckLang);
    if (cached) {
      substance = cached.substance;
      layout = cached.layout;
    } else {
      ({ substance, layout } = await runPipeline({
        transcript: transcriptText,
        videoTitle: meta.title,
        gradeBand: band,
        theme: chosenTheme,
        lang: deckLang,
      }));
      cacheSet(videoId, band, deckLang, { substance, layout });
    }

    const deck = saveDeck({
      lang: deckLang,
      title: layout.headline || substance.topic || meta.title,
      authorName: "",
      ownerEmail: currentUser ? currentUser.email : null, // null = anonymous student deck
      theme: chosenTheme,
      gradeBand,
      videoId,
      videoTitle: meta.title,
      videoAuthor: meta.author,
      videoThumb: meta.thumbnail,
      substance,
      layout,
    });

    // The editKey is returned once, only to the creator — it lets them rename the deck.
    const { editKey, ...publicDeck } = deck;
    if (currentUser) auth.recordCreation(currentUser.email);
    res.json({ slug: deck.slug, editKey, deck: publicDeck });
  } catch (err) {
    if (err.message === "MISSING_API_KEY") {
      return res.status(500).json({ error: "The server is missing its ANTHROPIC_API_KEY. (Site owner: see the Deployment Guide, Step 4.)" });
    }
    if (err.message === "NOT_APPROPRIATE") {
      return res.status(422).json({ error: "That video isn't a good fit for a school deck. Pick a different one!" });
    }
    if (String(err.message).startsWith("CLAUDE_API_")) {
      console.error("Claude API error:", err.message, err.detail || "");
      return res.status(502).json({ error: "The AI helper is busy right now. Please try again in a moment." });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on our side. Please try again." });
  }
});

// ---------- API: read a deck ----------
// NOTE: /api/decks/today must be declared BEFORE /api/decks/:slug, or "today"
// would be captured as a slug.
app.get("/api/decks/today", (req, res) => {
  const lang = req.query.lang === "es" ? "es" : req.query.lang === "en" ? "en" : null;
  res.json({ decks: decksToday(lang).slice(0, 60) });
});
app.get("/api/decks/:slug", (req, res) => {
  const deck = getDeck(req.params.slug);
  if (!deck) return res.status(404).json({ error: "Deck not found." });
  const { editKey, ...publicDeck } = deck;
  res.json({ deck: publicDeck });
});

// ---------- API: personalize a deck (custom title + name) ----------
// Requires the editKey that was handed to the deck's creator, so strangers
// with just the share link can't change someone's deck.
app.patch("/api/decks/:slug", (req, res) => {
  const { title, authorName, editKey } = req.body || {};
  const existing = getDeck(req.params.slug);
  if (!existing) return res.status(404).json({ error: "Deck not found." });
  if (!editKey || editKey !== existing.editKey) {
    return res.status(403).json({ error: "Only the deck's creator can rename it." });
  }
  const clean = (s, max) =>
    typeof s === "string" ? s.replace(/[<>]/g, "").trim().slice(0, max) : undefined;
  const patch = {};
  const t = clean(title, 80);
  const a = clean(authorName, 40);
  if (t !== undefined && t.length) patch.title = t;
  if (a !== undefined) patch.authorName = a;
  const deck = updateDeck(req.params.slug, patch);
  const { editKey: _hidden, ...publicDeck } = deck;
  res.json({ deck: publicDeck });
});

// ---------- API: "Make one like this" — remix a shared deck ----------
// The viewer-to-creator loop. A viewer of any shared deck taps one button and
// gets their OWN deck (new slug + editKey) reusing the source's substance, with
// their chosen theme, title, and name. Zero AI, one file write — so it's cheap
// enough to be generous with the rate limit.
const remixHits = new Map();
function remixRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const list = (remixHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= 40) {
    return res.status(429).json({ error: "That's a lot of remixes! Take a short break and try again." });
  }
  list.push(now);
  remixHits.set(ip, list);
  next();
}

app.post("/api/decks/:slug/remix", remixRateLimit, (req, res) => {
  if (honeypotHit(req.body)) return res.status(400).json({ error: "Something went wrong. Please try again." });
  const source = getDeck(req.params.slug);
  if (!source) return res.status(404).json({ error: "That deck no longer exists." });

  const body = req.body || {};
  const theme = THEMES.includes(body.theme) ? body.theme : source.theme;
  const clean = (s, max, fallback = "") =>
    (typeof s === "string" ? s.replace(/[<>]/g, "").trim().slice(0, max) : "") || fallback;
  const title = clean(body.title, 80, source.title);
  const authorName = clean(body.authorName, 40, "");

  // Reuse the source's extracted content; only the presentation is new.
  const deck = saveDeck({
    title,
    authorName,
    theme,
    gradeBand: source.gradeBand,
    videoId: source.videoId,
    videoTitle: source.videoTitle,
    videoAuthor: source.videoAuthor,
    videoThumb: source.videoThumb,
    substance: source.substance,
    layout: source.layout,
    remixedFrom: source.slug, // lineage, handy for later analytics
  });

  const { editKey, ...publicDeck } = deck;
  res.json({ slug: deck.slug, editKey, deck: publicDeck });
});

// ---------- Image export: /d/:slug/image.png and .svg (the growth loop) ----------
// Cache rendered PNGs on disk so a popular deck isn't re-rasterized every share.
const IMG_CACHE = path.join(process.env.DATA_DIR || path.join(__dirname, "data"), "img-cache");
fs.mkdirSync(IMG_CACHE, { recursive: true });

function safeSlug(slug) {
  return /^[a-z0-9-]+$/i.test(slug) ? slug : null;
}

app.get("/d/:slug/image.png", (req, res) => {
  const slug = safeSlug(req.params.slug);
  if (!slug) return res.status(400).send("bad request");
  const deck = getDeck(slug);
  if (!deck) return res.status(404).send("Deck not found.");
  try {
    // Cache key includes title/author/theme so renames refresh the image.
    const stamp = Buffer.from(`${deck.title}|${deck.authorName}|${deck.theme}`).toString("hex").slice(0, 16);
    const cachePath = path.join(IMG_CACHE, `${slug}-${stamp}.png`);
    let png;
    if (fs.existsSync(cachePath)) {
      png = fs.readFileSync(cachePath);
    } else {
      png = renderPng(deck);
      fs.writeFileSync(cachePath, png);
    }
    res.setHeader("content-type", "image/png");
    res.setHeader("cache-control", "public, max-age=86400");
    res.setHeader("content-disposition", `inline; filename="${slug}.png"`);
    res.send(png);
  } catch (err) {
    console.error("image render failed:", err);
    res.status(500).send("Could not render image.");
  }
});

app.get("/d/:slug/image.svg", (req, res) => {
  const slug = safeSlug(req.params.slug);
  if (!slug) return res.status(400).send("bad request");
  const deck = getDeck(slug);
  if (!deck) return res.status(404).send("Deck not found.");
  try {
    res.setHeader("content-type", "image/svg+xml; charset=utf-8");
    res.send(buildDeckSvg(deck));
  } catch (err) {
    console.error("svg build failed:", err);
    res.status(500).send("Could not build image.");
  }
});

// ---------- Share page: /d/:slug ----------
const shareTemplate = fs.readFileSync(path.join(__dirname, "public", "share.html"), "utf8");
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

app.get("/d/:slug", (req, res) => {
  const deck = getDeck(req.params.slug);
  if (!deck) return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  const { editKey, ...publicDeck } = deck; // never leak the edit secret
  const pageTitle = `${deck.title}${deck.authorName ? " — by " + deck.authorName : ""}`;
  const desc = deck.layout && deck.layout.subhead ? deck.layout.subhead : "A one-page deck made with KooDeck.";
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const origin = `${proto}://${req.headers.host}`;
  const ogImage = `${origin}/d/${deck.slug}/image.png`; // the rendered deck itself
  const html = shareTemplate
    .replaceAll("{{TITLE}}", esc(pageTitle))
    .replaceAll("{{DESC}}", esc(desc))
    .replaceAll("{{IMAGE}}", esc(ogImage))
    .replaceAll("{{SLUG}}", esc(deck.slug))
    .replace("{{DECK_JSON}}", JSON.stringify(publicDeck).replace(/</g, "\\u003c"));
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(html);
});

// ---------- Spanish share page: /es/d/:slug (same deck data, Spanish chrome) ----------
const esShareTemplate = fs.readFileSync(path.join(__dirname, "public", "es", "share.html"), "utf8");
app.get("/es/d/:slug", (req, res) => {
  const deck = getDeck(req.params.slug);
  if (!deck) return res.status(404).sendFile(path.join(__dirname, "public", "es", "404.html"));
  const { editKey, ...publicDeck } = deck;
  const pageTitle = `${deck.title}${deck.authorName ? " — por " + deck.authorName : ""}`;
  const desc = deck.layout && deck.layout.subhead ? deck.layout.subhead : "Un deck de una página hecho con KooDeck.";
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const origin = `${proto}://${req.headers.host}`;
  const ogImage = `${origin}/d/${deck.slug}/image.png`;
  const html = esShareTemplate
    .replaceAll("{{TITLE}}", esc(pageTitle))
    .replaceAll("{{DESC}}", esc(desc))
    .replaceAll("{{IMAGE}}", esc(ogImage))
    .replaceAll("{{SLUG}}", esc(deck.slug))
    .replace("{{DECK_JSON}}", JSON.stringify(publicDeck).replace(/</g, "\\u003c"));
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(html);
});

// ---------- API: email signup (interest / updates) ----------
// KooDeck needs no account to use, but teachers/parents can leave an email
// to save their spot or get updates. Stored as a simple append-only file.
const SIGNUP_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, "data"), "signups.jsonl");
const signupHits = new Map();
app.post("/api/signups", async (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const list = (signupHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= 10) return res.status(429).json({ error: "Thanks — we already got your sign-up!" });
  list.push(now); signupHits.set(ip, list);

  if (honeypotHit(req.body)) return res.json({ ok: true }); // bot filled the hidden field — pretend success, store nothing
  const { email, role } = req.body || {};
  const clean = String(email || "").trim().slice(0, 200);
  // Simple, permissive email sanity check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const roles = ["teacher", "parent", "student", "other"];
  const cleanRole = roles.includes(role) ? role : "other";
  const record = { email: clean, role: cleanRole, ts: new Date().toISOString() };
  try {
    fs.appendFileSync(SIGNUP_FILE, JSON.stringify(record) + "\n", "utf8");
  } catch (err) {
    console.error("signup write failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
  res.json({ ok: true });
});

// ---------- Accounts (adults only: teachers/parents) ----------
app.get("/login", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(loginHtml); });
app.get("/signup", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(loginHtml); });
app.get("/reset", (_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.send(resetHtml); });
app.get("/pricing", (_req, res) => res.sendFile(path.join(__dirname, "public", "pricing.html")));
app.get("/account", (_req, res) => res.sendFile(path.join(__dirname, "public", "account.html")));

// New pages: contact, FAQ, and the listing pages (today's decks, all dashes, my decks)
const staticPage = (dir, file) => (_req, res) => res.sendFile(path.join(__dirname, "public", dir, file));
for (const p of ["contact", "faq", "today", "dashes", "mydecks"]) {
  app.get("/" + p, staticPage(".", p + ".html"));
  app.get("/es/" + p, staticPage("es", p + ".html"));
}

const authHits = new Map();
function authRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const list = (authHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= 20) return res.status(429).json({ error: "Too many attempts. Please wait a few minutes." });
  list.push(now); authHits.set(ip, list); next();
}

app.post("/api/auth/register", authRateLimit, async (req, res) => {
  if (honeypotHit(req.body)) return res.status(400).json({ error: "Something went wrong. Please try again." });
  const ts = await verifyTurnstile((req.body || {}).turnstileToken, getClientIp(req));
  if (!ts.ok) return res.status(403).json({ error: "Please complete the security check and try again." });
  const { email, password } = req.body || {};
  const result = auth.createUser(email, password);
  if (result.error) return res.status(400).json({ error: result.error });
  res.setHeader("Set-Cookie", auth.makeSessionCookie(email));
  res.json({ user: result.user });
});

app.post("/api/auth/login", authRateLimit, (req, res) => {
  if (honeypotHit(req.body)) return res.status(400).json({ error: "Something went wrong. Please try again." });
  const { email, password } = req.body || {};
  const u = auth.authenticate(email, password);
  if (!u) return res.status(401).json({ error: "Wrong email or password." });
  res.setHeader("Set-Cookie", auth.makeSessionCookie(u.email));
  res.json({ user: auth.publicUser(u) });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", auth.clearSessionCookie());
  res.json({ ok: true });
});

// ---------- Password reset ----------
// Optional email delivery: if RESEND_API_KEY (+ RESET_FROM_EMAIL) is set, the
// reset link is emailed via Resend's HTTP API (no npm dependency). If not
// configured, the endpoint still creates the token; an admin can generate a
// link with scripts/reset-link.js and give it to the user (documented).
async function sendResetEmail(toEmail, link) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESET_FROM_EMAIL || "KooDeck <onboarding@resend.dev>";
  if (!key) return { sent: false, reason: "no_email_provider" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "authorization": "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({
        from, to: [toEmail], subject: "Reset your KooDeck password",
        text: `Someone asked to reset the password for your KooDeck account.\n\nReset it here (link expires in 1 hour):\n${link}\n\nIf you didn't ask for this, you can safely ignore this email.`,
      }),
    });
    if (!r.ok) {
      // Surface the reason so the site owner can see it in the logs (common causes:
      // unverified sending domain, or the default sender only mailing the account owner).
      const detail = await r.text().catch(() => "");
      console.error("[password-reset] Resend send failed:", r.status, detail.slice(0, 300));
      return { sent: false, reason: "resend_error", status: r.status };
    }
    return { sent: true };
  } catch (e) {
    console.error("[password-reset] Resend request threw:", e.message);
    return { sent: false, reason: "send_failed" };
  }
}

app.post("/api/auth/request-reset", authRateLimit, async (req, res) => {
  if (honeypotHit(req.body)) return res.json({ ok: true }); // silent to bots
  const email = ((req.body || {}).email || "").trim();
  const raw = auth.validEmail(email) ? auth.createResetToken(email) : null;
  if (raw) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const origin = `${proto}://${req.headers.host}`;
    const isES = (req.headers.referer || "").includes("/es/");
    const link = `${origin}${isES ? "/es" : ""}/reset?token=${encodeURIComponent(raw)}`;
    const mail = await sendResetEmail(email, link);
    // If email isn't configured (or failed), log the link so the site owner can
    // deliver it. For a cleaner path, run: node scripts/reset-link.js <email>
    if (!mail.sent) {
      console.log("[password-reset] email not sent (" + (mail.reason || "unknown") + "). Reset link for " + email + ":\n  " + link +
        "\n  (Set RESEND_API_KEY to email these automatically, or run: node scripts/reset-link.js " + email + ")");
    }
  }
  // Always generic — never reveal whether the account exists.
  res.json({ ok: true, message: "If an account exists for that email, a reset link is on its way." });
});

app.post("/api/auth/reset", authRateLimit, (req, res) => {
  const { token, password } = req.body || {};
  const result = auth.resetPassword(token, password);
  if (result.error) return res.status(400).json({ error: result.error });
  // Log them in immediately after a successful reset.
  res.setHeader("Set-Cookie", auth.makeSessionCookie(result.email));
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const u = auth.userFromRequest(req);
  res.json({ user: u ? auth.publicUser(u) : null });
});

// ---------- Daily Dash game (the /play subpage) ----------
app.get("/api/daily", (_req, res) => res.json(getDaily()));

// ---------- Listing endpoints (today's decks, my decks, all community dashes) ----------
app.get("/api/dashes", (req, res) => {
  const lang = req.query.lang === "es" ? "es" : req.query.lang === "en" ? "en" : null;
  res.json({ dashes: allDashes(lang).slice(0, 60) });
});
app.get("/api/my/decks", (req, res) => {
  const u = auth.userFromRequest(req);
  if (!u) return res.status(401).json({ error: "Log in to see your decks.", needsAuth: true });
  res.json({ decks: decksByOwner(u.email) });
});

// Turn a deck into a playable Daily-Dash-style pack. Distractors are drawn from
// the deck's other quiz answers + vocab (no extra AI call). Creator authorizes
// with the editKey they received when the deck was made (works for account-less
// student creators too).
function deckToDashPack(deck) {
  const quiz = (deck.substance && deck.substance.quiz) || [];
  const vocab = (deck.substance && deck.substance.vocab) || [];
  const answerPool = quiz.map((q) => String(q.a)).concat(vocab.map((v) => v.word)).filter(Boolean);
  const clean = (s) => String(s || "").slice(0, 90);
  const questions = quiz.slice(0, 5).map((item) => {
    const correct = clean(item.a);
    // pick up to 3 distinct distractors from the pool, excluding the correct one
    const pool = [...new Set(answerPool.map(clean))].filter((x) => x && x !== correct);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const distractors = pool.slice(0, 3);
    while (distractors.length < 3) distractors.push(["None of these", "All of these", "Not sure"][distractors.length]); // safe fallers
    const choices = [correct, ...distractors];
    for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
    return { q: clean(item.q), choices, a: choices.indexOf(correct), fun: clean((deck.substance && deck.substance.fun_fact) || "") };
  }).filter((q) => q.q && q.choices.length === 4 && q.a >= 0);
  return {
    id: "deck-" + deck.slug,
    title: deck.title || "Community Dash",
    emoji: (deck.layout && deck.layout.hero_emoji) || "✨",
    theme: deck.theme || "space",
    subject: (deck.substance && deck.substance.topic) || "",
    fromDeck: deck.slug,
    lang: deck.lang || "en",
    questions,
  };
}

app.post("/api/decks/:slug/to-dash", (req, res) => {
  const deck = getDeck(req.params.slug);
  if (!deck) return res.status(404).json({ error: "Deck not found." });
  const u = auth.userFromRequest(req);
  const key = (req.body || {}).editKey;
  const authorized = (u && deck.ownerEmail && u.email === deck.ownerEmail) || (key && key === deck.editKey);
  if (!authorized) return res.status(403).json({ error: "Only the deck's creator can turn it into a Dash." });
  const pack = deckToDashPack(deck);
  if (pack.questions.length < 3) {
    return res.status(422).json({ error: "This deck doesn't have enough quiz questions to make a Dash. Try a video with more content." });
  }
  updateDeck(req.params.slug, { isDash: true });
  res.json({ ok: true, dashSlug: deck.slug, questions: pack.questions.length });
});

// Play a community dash built from a deck
app.get("/api/dash/:slug", (req, res) => {
  const deck = getDeck(req.params.slug);
  if (!deck || !deck.isDash) return res.status(404).json({ error: "Dash not found." });
  res.json({ pack: deckToDashPack(deck) });
});

app.get("/api/packs", (_req, res) => res.json({ packs: listPacks() }));
app.get("/api/packs/:id", (req, res) => {
  const p = getPack(req.params.id);
  if (!p) return res.status(404).json({ error: "Pack not found." });
  res.json(p);
});

// Challenges: "beat my score" links.
const challengeHits = new Map();
const cleanStr = (s, max) => (typeof s === "string" ? s.replace(/[<>]/g, "").trim().slice(0, max) : "");
app.post("/api/challenges", (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const list = (challengeHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= 30) return res.status(429).json({ error: "Whoa, speedy! Take a short break and dash again." });
  list.push(now); challengeHits.set(ip, list);

  if (honeypotHit(req.body)) return res.status(400).json({ error: "Something went wrong. Please try again." });
  const { packId, date, name, score, emojiRow } = req.body || {};
  const record = saveChallenge({
    packId: cleanStr(packId, 60) || "daily",
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : todayStr(),
    name: cleanStr(name, 24) || "A mystery dasher",
    score: Math.max(0, Math.min(9999, parseInt(score, 10) || 0)),
    emojiRow: cleanStr(emojiRow, 20).replace(/[^🟩🟨🟥⚡]/gu, "").slice(0, 10) || "🟩",
  });
  res.json({ slug: record.slug });
});
app.get("/api/challenges/:slug", (req, res) => {
  const c = getChallenge(req.params.slug);
  if (!c) return res.status(404).json({ error: "Challenge not found." });
  res.json({ challenge: c });
});

// Challenge share page with OG tags: /c/:slug
const challengeTemplate = fs.readFileSync(path.join(__dirname, "public", "challenge.html"), "utf8");
app.get("/c/:slug", (req, res) => {
  const c = getChallenge(req.params.slug);
  if (!c) return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  const title = `${c.name} scored ${c.score} — can you beat it?`;
  const html = challengeTemplate
    .replaceAll("{{TITLE}}", esc(title))
    .replaceAll("{{DESC}}", esc(`Daily Dash · ${c.emojiRow} · 5 quick questions, same for both of you. No sign-up.`))
    .replace("{{CH_JSON}}", JSON.stringify(c).replace(/</g, "\\u003c"));
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(html);
});

app.get("/healthz", (_req, res) => res.send("ok"));

app.listen(PORT, () => {
  try {
    const seeded = seedExamples();
    if (seeded.length) console.log(`Seeded ${seeded.length} showcase decks.`);
  } catch (e) {
    console.error("example seeding failed:", e);
  }
  console.log(`KooDeck running → http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠️  ANTHROPIC_API_KEY is not set. Deck creation will fail until you add it.");
  }
});
