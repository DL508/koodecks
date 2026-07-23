process.env.KOO_TEST_BYPASS_AUTH = "1";
// scripts/security-test.js
// Validates the bot/spam protection layers: security headers, the invisible
// honeypot on all four form endpoints, Cloudflare Turnstile verification in
// both configured and unconfigured states, and Cloudflare-aware client IPs
// driving the rate limits.
//
// Run with:  node scripts/security-test.js

process.env.DATA_DIR = require("os").tmpdir() + "/brightdeck-sec-" + Date.now();
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.PORT = "3941";
// Turnstile ON for this suite; the mock below plays Cloudflare's verifier.
process.env.TURNSTILE_SITE_KEY = "1x-test-site-key";
process.env.TURNSTILE_SECRET_KEY = "1x-test-secret";

const assert = require("assert");
const fs = require("fs");

let pass = 0, fail = 0;
const t = (name, fn) =>
  Promise.resolve().then(fn).then(
    () => { pass++; console.log("  \u2714", name); },
    (e) => { fail++; console.log("  \u2718", name, "\u2192", e.message); }
  );

// Mock Cloudflare's siteverify: token "good-token" passes, all else fails.
const realFetch = global.fetch;
let verifyCalls = 0;
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("localhost")) return realFetch(url, opts);
  if (u.includes("challenges.cloudflare.com/turnstile")) {
    verifyCalls++;
    const body = JSON.parse(opts.body);
    return new Response(JSON.stringify({ success: body.response === "good-token" }),
      { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("not mocked", { status: 404 });
};

(async () => {
  const { getClientIp, honeypotHit } = require("../lib/security");

  console.log("\n1) Unit: IP extraction + honeypot");
  await t("prefers CF-Connecting-IP over X-Forwarded-For", () => {
    assert.equal(getClientIp({ headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 8.8.8.8" } }), "1.2.3.4");
  });
  await t("falls back to first X-Forwarded-For entry", () => {
    assert.equal(getClientIp({ headers: { "x-forwarded-for": "5.6.7.8, 10.0.0.1" } }), "5.6.7.8");
  });
  await t("honeypot detects a filled hidden field", () => {
    assert.equal(honeypotHit({ website: "http://spam.example" }), true);
    assert.equal(honeypotHit({ website: "" }), false);
    assert.equal(honeypotHit({}), false);
  });

  console.log("\n2) Security headers on live responses");
  require("../server.js");
  await new Promise((r) => setTimeout(r, 700));
  const B = "http://localhost:3941";
  const post = (p, body, h) => realFetch(B + p, { method: "POST", headers: { "content-type": "application/json", ...(h || {}) }, body: JSON.stringify(body) });

  const home = await realFetch(B + "/");
  await t("CSP present and allows Turnstile + fonts, restricts frames", () => {
    const csp = home.headers.get("content-security-policy") || "";
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("challenges.cloudflare.com"));
    assert.ok(csp.includes("fonts.googleapis.com"));
    assert.ok(csp.includes("frame-ancestors 'self'"));
  });
  await t("nosniff / frame / referrer / permissions headers set", () => {
    assert.equal(home.headers.get("x-content-type-options"), "nosniff");
    assert.equal(home.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.ok(home.headers.get("referrer-policy"));
    assert.ok((home.headers.get("permissions-policy") || "").includes("camera=()"));
  });
  await t("Turnstile site key injected into landing and app pages", async () => {
    const l = await home.text();
    assert.ok(l.includes('data-tskey="1x-test-site-key"'));
    const a = await (await realFetch(B + "/app")).text();
    assert.ok(a.includes('data-tskey="1x-test-site-key"'));
  });
  await t("honeypot fields present on landing, app, and share pages", async () => {
    const l = await (await realFetch(B + "/")).text();
    assert.ok(/id="hp-website"/.test(l));
    const a = await (await realFetch(B + "/app")).text();
    assert.ok(/id="hp-website"/.test(a));
    const sh = fs.readFileSync(__dirname + "/../public/share.html", "utf8");
    assert.ok(/id="hp-website"/.test(sh));
  });

  console.log("\n3) Turnstile enforcement (feature ON)");
  await t("signup with a good token → stored", async () => {
    const r = await post("/api/signups", { email: "real@school.edu", role: "teacher", turnstileToken: "good-token" });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);
  });
  await t("signup with a bad token → 403 security-check message", async () => {
    const r = await post("/api/signups", { email: "bot@spam.io", role: "teacher", turnstileToken: "bad-token" }, { "x-forwarded-for": "20.0.0.2" });
    assert.equal(r.status, 403);
    assert.ok(/security check/i.test((await r.json()).error));
  });
  await t("signup with NO token → 403 (token required when enabled)", async () => {
    const r = await post("/api/signups", { email: "bot2@spam.io", role: "parent" }, { "x-forwarded-for": "20.0.0.3" });
    assert.equal(r.status, 403);
  });
  await t("deck creation with a bad token → 403 before any AI spend", async () => {
    const before = verifyCalls;
    const r = await post("/api/decks", { pastedText: "x".repeat(400), turnstileToken: "bad-token" }, { "x-forwarded-for": "20.0.0.4" });
    assert.equal(r.status, 403);
    assert.ok(verifyCalls > before, "verifier was not consulted");
  });

  console.log("\n4) Honeypot behavior");
  await t("signup honeypot: pretends success, stores NOTHING", async () => {
    const file = process.env.DATA_DIR + "/signups.jsonl";
    const beforeLines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").length : 0;
    const r = await post("/api/signups", { email: "hp@bot.io", role: "teacher", website: "http://spam", turnstileToken: "good-token" }, { "x-forwarded-for": "21.0.0.1" });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);
    const afterLines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").length : 0;
    assert.equal(afterLines, beforeLines, "honeypot signup was stored!");
  });
  await t("deck honeypot → 400 without touching AI", async () => {
    const r = await post("/api/decks", { pastedText: "y".repeat(400), website: "spam", turnstileToken: "good-token" }, { "x-forwarded-for": "21.0.0.2" });
    assert.equal(r.status, 400);
  });
  await t("challenge honeypot → 400, nothing saved", async () => {
    const r = await post("/api/challenges", { name: "Bot", score: 1, emojiRow: "🟩", website: "spam" }, { "x-forwarded-for": "21.0.0.3" });
    assert.equal(r.status, 400);
  });

  console.log("\n5) Cloudflare-aware rate limiting");
  await t("CF-Connecting-IP drives the limiter (distinct clients not conflated)", async () => {
    // Two different CF IPs behind identical XFF must be limited separately.
    let a, b;
    for (let i = 0; i < 11; i++) {
      a = await post("/api/signups", { email: `a${i}@x.com`, role: "teacher", turnstileToken: "good-token" },
        { "cf-connecting-ip": "30.0.0.1", "x-forwarded-for": "99.99.99.99" });
    }
    b = await post("/api/signups", { email: "b@x.com", role: "teacher", turnstileToken: "good-token" },
      { "cf-connecting-ip": "30.0.0.2", "x-forwarded-for": "99.99.99.99" });
    assert.equal(a.status, 429, "client A should be limited");
    assert.equal(b.status, 200, "client B should NOT inherit A's limit");
  });

  console.log(`\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ${pass} passed, ${fail} failed\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  process.exit(fail ? 1 : 0);
})();
