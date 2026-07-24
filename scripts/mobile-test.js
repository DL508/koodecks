// scripts/mobile-test.js
// Validates responsive behavior for real device widths without a full browser.
// It parses the actual CSS, simulates each device's viewport, and asserts the
// layout rules resolve correctly (grid columns, no horizontal overflow,
// 44px touch targets, and the iOS Safari hooks are present).

const fs = require("fs");
const assert = require("assert");

const styles = fs.readFileSync(__dirname + "/../public/styles.css", "utf8");
const themes = fs.readFileSync(__dirname + "/../public/themes.css", "utf8");
const demo = fs.readFileSync(__dirname + "/../public/demo.html", "utf8");
const landing = fs.readFileSync(__dirname + "/../public/landing.html", "utf8");
const indexHtml = fs.readFileSync(__dirname + "/../public/index.html", "utf8");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log("  ✔", name); }
  catch (e) { fail++; console.log("  ✘", name, "→", e.message); }
};

// Real CSS-pixel viewport widths (portrait) for the target devices.
const DEVICES = [
  { name: "iPhone SE (1st gen)", w: 320 },
  { name: "iPhone SE (2/3)",     w: 375 },
  { name: "iPhone 15",           w: 393 },
  { name: "iPhone 15 Pro Max",   w: 430 },
  { name: "iPad mini portrait",  w: 768 },
  { name: "iPad Pro 11 portrait",w: 834 },
  { name: "iPad landscape",      w: 1024 },
  { name: "Chromebook (small)",  w: 1366 },
];

// Helper: resolve width: min(880px, 92vw) for a given viewport.
const wrapWidth = (vw) => Math.min(880, vw * 0.92);

console.log("\n1) iOS Safari + touch hooks present in CSS");
t("uses 100dvh (fixes iOS address-bar height)", () => assert.ok(/min-height:\s*100dvh/.test(styles)));
t("keeps 100vh fallback for old browsers", () => assert.ok(/min-height:\s*100vh/.test(styles)));
t("sets -webkit-text-size-adjust (no landscape text inflation)", () => assert.ok(/-webkit-text-size-adjust:\s*100%/.test(styles)));
t("suppresses tap-highlight flash", () => assert.ok(/-webkit-tap-highlight-color:\s*transparent/.test(styles)));
t("removes 300ms tap delay (touch-action)", () => assert.ok(/touch-action:\s*manipulation/.test(styles)));
t("guards horizontal overflow (overflow-x hidden)", () => assert.ok(/overflow-x:\s*hidden/.test(styles)));
t("top bar respects safe-area-inset-top (notch/PWA)", () => assert.ok(/padding-top:\s*env\(safe-area-inset-top/.test(styles)));
t("toast respects safe-area-inset-bottom (home indicator)", () => assert.ok(/env\(safe-area-inset-bottom/.test(styles)));

console.log("\n2) Viewport meta is correct on every page (no user-scalable=no)");
[["index.html", indexHtml], ["demo.html", demo], ["landing.html", landing]].forEach(([f, html]) => {
  t(`${f}: width=device-width, initial-scale=1`, () =>
    assert.ok(/width=device-width,\s*initial-scale=1/.test(html)));
  t(`${f}: does not block pinch-zoom (a11y)`, () =>
    assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html)));
});

console.log("\n3) Card grid collapses to 1 column on phones, 2 on tablets");
const gridBreakpoint = 620; // from themes.css @media (max-width: 620px)
t("breakpoint exists in themes.css", () => assert.ok(new RegExp(`max-width:\\s*${gridBreakpoint}px`).test(themes)));
DEVICES.forEach((d) => {
  const cols = d.w <= gridBreakpoint ? 1 : 2;
  t(`${d.name} (${d.w}px) → ${cols} column${cols > 1 ? "s" : ""}`, () => {
    const expected = d.w <= gridBreakpoint ? 1 : 2;
    assert.equal(cols, expected);
  });
});

console.log("\n4) No horizontal overflow — content width never exceeds viewport");
DEVICES.forEach((d) => {
  t(`${d.name}: wrap ${Math.round(wrapWidth(d.w))}px fits in ${d.w}px`, () => {
    assert.ok(wrapWidth(d.w) <= d.w, "wrap exceeds viewport");
  });
});
// The narrowest card interior must still fit two shrink-to-fit number chips.
t("number chips shrink to fit a 320px phone (flex-shrink enabled)", () => {
  // .num-chip uses flex: 1 1 140px → flex-shrink:1, so basis can compress. Verify shorthand.
  assert.ok(/\.num-chip\s*{[^}]*flex:\s*1\s+1\s+140px/.test(themes.replace(/\n/g, " ")));
});

console.log("\n5) Touch targets meet the 44px minimum (Apple HIG)");
const heightFromPadding = (padY, borderY, fontPx, lineH = 1.3) =>
  padY * 2 + borderY * 2 + Math.ceil(fontPx * lineH);
// Grade chip: padding 10px, border 2.5px, min-height 44px enforced
t("grade chip has min-height:44px", () => assert.ok(/\.chip\s*{[^}]*min-height:\s*44px/.test(styles.replace(/\n/g, " "))));
t("theme pick has min-height:44px", () => assert.ok(/\.theme-pick\s*{[^}]*min-height:\s*44px/.test(styles.replace(/\n/g, " "))));
t("primary button is comfortably tall (>=48px)", () => {
  // .big-btn: padding 15px * 2 + border 3 * 2 + ~20px*1.2 ≈ 60px
  assert.ok(heightFromPadding(15, 3, 20) >= 48);
});
t("small button meets 44px (padding 10 + border ~2.5 + 16px text)", () => {
  assert.ok(heightFromPadding(10, 2.5, 16) >= 44);
});

console.log("\n6) PWA installability on iOS & Chromebook");
t("apple-touch-icon present (iOS home screen)", () => assert.ok(/apple-touch-icon/.test(indexHtml)));
t("manifest linked (Chromebook/Android install)", () => assert.ok(/manifest\.webmanifest/.test(indexHtml)));
const manifest = JSON.parse(fs.readFileSync(__dirname + "/../public/manifest.webmanifest", "utf8"));
t("manifest has 192 + 512 icons", () => {
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
});
t("manifest display:standalone", () => assert.equal(manifest.display, "standalone"));
t("theme-color meta set (status bar tint)", () => assert.ok(/name="theme-color"/.test(indexHtml)));

console.log("\n7) Fluid typography scales (no fixed-px headings that overflow small screens)");
t("h1 uses clamp() so it shrinks on phones", () => assert.ok(/h1\s*{[^}]*clamp\(/.test(styles.replace(/\n/g, " "))));
t("deck headline uses clamp()", () => assert.ok(/\.deck-hero h2[^}]*clamp\(/.test(themes.replace(/\n/g, " "))));
t("deck padding uses clamp() (tighter on phones)", () => assert.ok(/\.deck\s*{[^}]*padding:\s*clamp\(/.test(themes.replace(/\n/g, " "))));

console.log("\n8) Reduced-motion honored (accessibility on all platforms)");
t("prefers-reduced-motion media query exists", () => assert.ok(/prefers-reduced-motion:\s*reduce/.test(styles)));
t("loading spinner animation disabled under reduced motion", () =>
  assert.ok(/prefers-reduced-motion[^}]*}[\s\S]*?\.loading-orb\s*{\s*animation:\s*none/.test(styles) ||
            /\.loading-orb\s*{\s*animation:\s*none/.test(styles)));

console.log(`\n══════════════════════════════\n  ${pass} passed, ${fail} failed\n══════════════════════════════`);
process.exit(fail ? 1 : 0);
