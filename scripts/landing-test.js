// scripts/landing-test.js
// Validates the landing page, the /app routing split, seeded showcase decks,
// and the email signup endpoint.
//
// Run with:  node scripts/landing-test.js

process.env.DATA_DIR = require("os").tmpdir() + "/brightdeck-landing-" + Date.now();
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.PORT = "3912";
process.env.ALTERNATE_SITE_URL = "https://brightdeck-es.test.example";

const assert = require("assert");
const fs = require("fs");

let pass = 0, fail = 0;
const t = (name, fn) =>
  Promise.resolve().then(fn).then(
    () => { pass++; console.log("  \u2714", name); },
    (e) => { fail++; console.log("  \u2718", name, "\u2192", e.message); }
  );

(async () => {
  require("../server.js");
  await new Promise((r) => setTimeout(r, 700));
  const base = "http://localhost:3912";
  const txt = (r) => r.text();
  const j = (r) => r.json();

  console.log("\n1) Routing: landing is the front door, app lives at /app");
  const home = await fetch(base + "/");
  const homeHtml = await home.text();
  await t("GET / returns 200", () => assert.equal(home.status, 200));
  await t("/ is the landing page (marketing hero, not the maker form)", () => {
    assert.ok(/deck kids/i.test(homeHtml), "landing headline missing");
    assert.ok(!/id="deck-form"/.test(homeHtml), "should not be the app form");
  });
  const app = await fetch(base + "/app");
  await t("GET /app returns 200", () => assert.equal(app.status, 200));
  await t("/app is the maker app (has the paste form)", async () => {
    assert.ok(/id="deck-form"/.test(await app.text()));
  });

  console.log("\n2) Landing content & CTAs");
  await t("has a Try-it-free call to action pointing at /app", () => assert.ok(/href="\/app"/.test(homeHtml)));
  await t("Daily Dash section present and placed near the end (before final CTA)", () => {
    assert.ok(/id="play"/.test(homeHtml), "Daily Dash section missing");
    assert.ok(homeHtml.indexOf('id="play"') < homeHtml.indexOf('final-cta'), "Dash should come before the final CTA");
    assert.ok(homeHtml.indexOf('id="play"') > homeHtml.indexOf('id="how"'), "Dash should be after How-it-works");
  });
  await t("removed sections stay removed (Save-your-spot + See-it-in-action)", () => {
    assert.ok(!/Save your spot/.test(homeHtml), "Save your spot should be gone");
    assert.ok(!/See it in action/.test(homeHtml) && !/id="examples"/.test(homeHtml), "examples section should be gone");
    assert.ok(!/id="signup"/.test(homeHtml), "signup card should be gone");
  });
  await t("hero renders single-column (hero-solo) after redesign", () => assert.ok(/hero-solo/.test(homeHtml)));
  await t("speaks to teachers, students, and parents", () =>
    assert.ok(/Teachers/.test(homeHtml) && /Students/.test(homeHtml) && /Parents/.test(homeHtml)));
  await t("no Turnstile widget on the landing page (scoped to login/signup only)", () =>
    assert.ok(!/ts-box/.test(homeHtml)));
  await t("loads landing.css", () => assert.ok(/landing\.css/.test(homeHtml)));
  await t("language switcher present with both options", () => {
    assert.ok(/id="lang-menu"/.test(homeHtml));
    assert.ok(/English/.test(homeHtml) && /Espa\u00f1ol/.test(homeHtml));
  });
  await t("mobile nav-hide rule is scoped so the switcher dropdown survives mobile", () => {
    const css = fs.readFileSync(__dirname + "/../public/landing.css", "utf8");
    // Must hide only DIRECT nav links, never the <a> options inside .lang-drop
    assert.ok(/\.topnav > a:not\(\.nav-cta\)/.test(css), "nav-hide should use direct-child selector");
    assert.ok(!/\n\s*\.topnav a:not\(\.nav-cta\) \{ display: none/.test(css), "broad descendant hide would break the switcher on mobile");
  });
  await t("alternate-site URL injected from ALTERNATE_SITE_URL", () =>
    assert.ok(homeHtml.includes('data-alt="https://brightdeck-es.test.example"'), "ALT_URL not injected"));
  await t("keeps the double-check-facts safety note", () => assert.ok(/double-check/i.test(homeHtml)));

  console.log("\n3) Seeded showcase decks exist and render");
  const slugs = ["example-water-cycle", "example-fractions", "example-photosynthesis", "example-solar-system"];
  for (const slug of slugs) {
    await t(`share page /d/${slug} → 200 and renders`, async () => {
      const r = await fetch(base + "/d/" + slug);
      assert.equal(r.status, 200);
      const html = await r.text();
      assert.ok(/id="deck-root"/.test(html));
      assert.ok(/Make one like this/.test(html), "remix loop should be present on examples too");
    });
    await t(`example ${slug} exposes an image (PNG 200)`, async () => {
      const r = await fetch(base + "/d/" + slug + "/image.png");
      assert.equal(r.status, 200);
      assert.ok((r.headers.get("content-type") || "").includes("image/png"));
    });
  }
  await t("examples are flagged as examples in storage", () => {
    const one = JSON.parse(fs.readFileSync(process.env.DATA_DIR + "/decks/example-water-cycle.json", "utf8"));
    assert.equal(one.example, true);
  });
  await t("re-seeding does not clobber an edited example", () => {
    const { seedDeck, getDeck } = require("../lib/store.js");
    seedDeck("example-water-cycle", { title: "SHOULD NOT OVERWRITE" });
    assert.notEqual(getDeck("example-water-cycle").title, "SHOULD NOT OVERWRITE");
  });

  console.log("\n4) Signup endpoint");
  const ok = await fetch(base + "/api/signups", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "teacher@school.edu", role: "teacher" }),
  });
  await t("valid signup → 200 {ok:true}", async () => {
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).ok, true);
  });
  await t("signup is written to the append-only file", () => {
    const lines = fs.readFileSync(process.env.DATA_DIR + "/signups.jsonl", "utf8").trim().split("\n");
    const rec = JSON.parse(lines[lines.length - 1]);
    assert.equal(rec.email, "teacher@school.edu");
    assert.equal(rec.role, "teacher");
    assert.ok(rec.ts);
  });
  await t("invalid email → 400", async () => {
    const r = await fetch(base + "/api/signups", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nope", role: "parent" }),
    });
    assert.equal(r.status, 400);
  });
  await t("unknown role is coerced to 'other'", async () => {
    await fetch(base + "/api/signups", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "5.6.7.8" },
      body: JSON.stringify({ email: "x@y.com", role: "hacker" }),
    });
    const lines = fs.readFileSync(process.env.DATA_DIR + "/signups.jsonl", "utf8").trim().split("\n");
    const rec = JSON.parse(lines[lines.length - 1]);
    assert.equal(rec.role, "other");
  });
  await t("signup email length is capped (no giant payloads)", async () => {
    const big = "a".repeat(5000) + "@x.com";
    const r = await fetch(base + "/api/signups", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.1" },
      body: JSON.stringify({ email: big, role: "teacher" }),
    });
    // Either rejected as invalid, or stored truncated — never a 5k email.
    if (r.status === 200) {
      const lines = fs.readFileSync(process.env.DATA_DIR + "/signups.jsonl", "utf8").trim().split("\n");
      assert.ok(JSON.parse(lines[lines.length - 1]).email.length <= 200);
    } else {
      assert.equal(r.status, 400);
    }
  });
  await t("signup CORS header present (works from anywhere)", () =>
    assert.equal(ok.headers.get("access-control-allow-origin"), "*"));

  console.log("\n5) Old entry points still work");
  await t("/demo.html still 200", async () => assert.equal((await fetch(base + "/demo.html")).status, 200));
  await t("static assets still served (styles.css)", async () => assert.equal((await fetch(base + "/styles.css")).status, 200));
  await t("landing.css served", async () => assert.equal((await fetch(base + "/landing.css")).status, 200));
  await t("unknown deck still 404s", async () => assert.equal((await fetch(base + "/d/nope-nope-0000")).status, 404));

  console.log(`\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ${pass} passed, ${fail} failed\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  process.exit(fail ? 1 : 0);
})();
