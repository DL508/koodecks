// scripts/image-test.js
// Validates the shareable-image feature end to end: SVG is well-formed, PNG is
// valid and correctly sized, the watermark is present, emoji render in color,
// every theme works, edge cases (long text, missing fields, sparse decks)
// don't crash, and the HTTP endpoints behave.
//
// Run with:  node scripts/image-test.js

process.env.DATA_DIR = require("os").tmpdir() + "/brightdeck-imgtest-" + Date.now();
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.PORT = "3789";

const assert = require("assert");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { buildDeckSvg, renderPng, THEMES } = require("../lib/image.js");
const { saveDeck } = require("../lib/store.js");

let pass = 0, fail = 0;
const t = (name, fn) =>
  Promise.resolve().then(fn).then(
    () => { pass++; console.log("  ✔", name); },
    (e) => { fail++; console.log("  ✘", name, "→", e.message); }
  );

const PNG_SIG = "89504e470d0a1a0a";
const pngDims = (b) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

// Analyze a PNG with a tiny Python/PIL helper (already used elsewhere in dev).
function analyzePng(buf) {
  const tmp = process.env.DATA_DIR + "/_a.png";
  fs.writeFileSync(tmp, buf);
  const py = `
from PIL import Image
im=Image.open(${JSON.stringify(tmp)}).convert('RGB')
w,h=im.size
buckets=set(); colorful=0; dark=0
for x in range(0,w,4):
  for y in range(0,h,4):
    r,g,b=im.getpixel((x,y))
    buckets.add((r//32,g//32,b//32))
    if max(r,g,b)-min(r,g,b)>40: colorful+=1
    if r+g+b<450: dark+=1
wm=0
for x in range(0,w,2):
  for y in range(h-150,h-30):
    if sum(im.getpixel((x,y)))<450: wm+=1
print(len(buckets),colorful,dark,wm)
`;
  const out = execFileSync("python3", ["-c", py]).toString().trim().split(/\s+/).map(Number);
  return { buckets: out[0], colorful: out[1], dark: out[2], watermark: out[3] };
}

const FULL_DECK = {
  theme: "ocean", title: "The Amazing Water Loop", authorName: "Maya R.",
  layout: { headline: "The Amazing Water Loop", subhead: "Where every raindrop has been", hero_emoji: "💧" },
  substance: {
    big_idea: "Water travels in a never-ending loop between the ocean, the sky, and the land.",
    key_points: [
      { title: "Evaporation", detail: "The sun heats water and turns it into invisible vapor that rises." },
      { title: "Condensation", detail: "High in the cold air, vapor turns back into tiny drops that form clouds." },
      { title: "Precipitation", detail: "When clouds get heavy, water falls as rain, snow, or hail." },
    ],
    numbers: [{ value: "97%", meaning: "of Earth's water is in the oceans" }, { value: "9 days", meaning: "average time a drop stays in the air" }],
    vocab: [{ word: "vapor", kid_definition: "water as an invisible gas" }],
    fun_fact: "Earth has been recycling the very same water for billions of years.",
    takeaway: "Next time it rains, remember that water has been on an incredible journey.",
  },
};

(async () => {
  console.log("\n1) SVG generation");
  const svg = buildDeckSvg(FULL_DECK);
  await t("returns a string starting with <svg and ending </svg>", () =>
    assert.ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>")));
  await t("is well-formed XML (parses without error)", () => {
    fs.writeFileSync(process.env.DATA_DIR + "/d.svg", svg);
    execFileSync("python3", ["-c", `import xml.dom.minidom;xml.dom.minidom.parse(${JSON.stringify(process.env.DATA_DIR + "/d.svg")})`]);
  });
  await t("contains the watermark text", () => assert.ok(svg.includes("koodeck.com")));
  await t("escapes special characters in content (no raw < injection)", () => {
    const evil = buildDeckSvg({ ...FULL_DECK, title: "A < B & \"C\"", authorName: "<x>" });
    // the only < that begin tags are real elements; our escaped content uses &lt;
    assert.ok(evil.includes("&lt;") && evil.includes("&amp;"));
    fs.writeFileSync(process.env.DATA_DIR + "/e.svg", evil);
    execFileSync("python3", ["-c", `import xml.dom.minidom;xml.dom.minidom.parse(${JSON.stringify(process.env.DATA_DIR + "/e.svg")})`]);
  });

  console.log("\n2) PNG rasterization");
  const png = renderPng(FULL_DECK);
  await t("produces a valid PNG", () => assert.equal(png.slice(0, 8).toString("hex"), PNG_SIG));
  await t("is 2160px wide (1080 @ 2x) for crisp phones", () => assert.equal(pngDims(png).w, 2160));
  await t("is a tall poster (height > width)", () => assert.ok(pngDims(png).h > pngDims(png).w));
  const a = analyzePng(png);
  await t("is visually rich (many colors, not blank)", () => assert.ok(a.buckets > 8, `only ${a.buckets} colors`));
  await t("emoji rendered in color (twemoji)", () => assert.ok(a.colorful > 5000, `only ${a.colorful} colorful px`));
  await t("text is present (dark pixels)", () => assert.ok(a.dark > 5000, `only ${a.dark} dark px`));
  await t("watermark is visibly rendered at the bottom", () => assert.ok(a.watermark > 100, `only ${a.watermark} wm px`));

  console.log("\n3) Every theme renders without crashing");
  for (const theme of Object.keys(THEMES)) {
    await t(`theme "${theme}" → valid PNG`, () => {
      const p = renderPng({ ...FULL_DECK, theme });
      assert.equal(p.slice(0, 8).toString("hex"), PNG_SIG);
      assert.equal(pngDims(p).w, 2160);
    });
  }

  console.log("\n4) Edge cases don't crash and stay valid");
  await t("sparse deck (only big idea + takeaway)", () => {
    const p = renderPng({ theme: "candy", title: "Tiny", layout: { hero_emoji: "🌟" }, substance: { big_idea: "Small.", takeaway: "Done." } });
    assert.equal(p.slice(0, 8).toString("hex"), PNG_SIG);
  });
  await t("very long title and points wrap without overflow error", () => {
    const p = renderPng({
      theme: "jungle", title: "This Is An Extremely Long Deck Title That Should Wrap Onto Several Lines Without Breaking Anything At All",
      layout: { hero_emoji: "🦁", subhead: "A subhead that is also quite long and keeps going on and on to test wrapping behavior thoroughly" },
      substance: {
        big_idea: "A very long big idea sentence that continues well past a single line to confirm the wrapping logic keeps text inside the card boundaries and grows the card height correctly.",
        key_points: Array.from({ length: 6 }, (_, i) => ({ title: "Point number " + (i + 1), detail: "Each point has a reasonably long explanation to stress the vertical layout and height computation across many stacked items." })),
      },
    });
    assert.equal(p.slice(0, 8).toString("hex"), PNG_SIG);
  });
  await t("deck with no emoji anywhere still renders", () => {
    const p = renderPng({ theme: "notebook", title: "No Emoji Here", layout: {}, substance: { big_idea: "Plain text only.", takeaway: "Fine." } });
    assert.equal(p.slice(0, 8).toString("hex"), PNG_SIG);
  });
  await t("missing substance fields handled gracefully", () => {
    const p = renderPng({ theme: "space", title: "Empty-ish", layout: {}, substance: {} });
    assert.equal(p.slice(0, 8).toString("hex"), PNG_SIG);
  });
  await t("multi-codepoint emoji falls back safely", () => {
    // hero emoji is a ZWJ/flag-like sequence; must not throw
    const p = renderPng({ theme: "ocean", title: "Flags", layout: { hero_emoji: "🇺🇸" }, substance: { big_idea: "Hi." } });
    assert.equal(p.slice(0, 8).toString("hex"), PNG_SIG);
  });

  console.log("\n5) HTTP endpoints");
  require("../server.js");
  await new Promise((r) => setTimeout(r, 600));
  const base = "http://localhost:3789";
  const deck = saveDeck({ ...FULL_DECK, videoId: "abc" });

  const pngRes = await fetch(`${base}/d/${deck.slug}/image.png`);
  await t("GET image.png → 200 image/png", () => {
    assert.equal(pngRes.status, 200);
    assert.ok(pngRes.headers.get("content-type").includes("image/png"));
  });
  const pngBody = Buffer.from(await pngRes.arrayBuffer());
  await t("image.png body is a real PNG", () => assert.equal(pngBody.slice(0, 8).toString("hex"), PNG_SIG));
  await t("image.png sets a caching header", () => assert.ok(/max-age/.test(pngRes.headers.get("cache-control") || "")));

  const pngRes2 = await fetch(`${base}/d/${deck.slug}/image.png`);
  await t("second request served from cache (still 200 PNG)", async () => {
    assert.equal(pngRes2.status, 200);
    const b2 = Buffer.from(await pngRes2.arrayBuffer());
    assert.equal(b2.length, pngBody.length);
  });
  await t("cache file was written to disk", () =>
    assert.ok(fs.readdirSync(process.env.DATA_DIR + "/img-cache").some((f) => f.startsWith(deck.slug))));

  const svgRes = await fetch(`${base}/d/${deck.slug}/image.svg`);
  await t("GET image.svg → 200 image/svg+xml", () => {
    assert.equal(svgRes.status, 200);
    assert.ok(svgRes.headers.get("content-type").includes("image/svg"));
  });

  await t("unknown deck image → 404", async () =>
    assert.equal((await fetch(`${base}/d/no-such-deck-0000/image.png`)).status, 404));
  await t("path-traversal slug in image route → 400/404 (never serves a file)", async () => {
    const r = await fetch(`${base}/d/..%2f..%2fetc/image.png`);
    assert.ok(r.status === 400 || r.status === 404);
  });

  await t("share page OG image points at the rendered PNG", async () => {
    const html = await (await fetch(`${base}/d/${deck.slug}`)).text();
    assert.ok(html.includes(`/d/${deck.slug}/image.png`));
    assert.ok(/property="og:image"/.test(html));
  });

  console.log(`\n══════════════════════════════\n  ${pass} passed, ${fail} failed\n══════════════════════════════`);
  process.exit(fail ? 1 : 0);
})();
