// lib/image.js
// Turns a deck into a shareable image (a tall "poster" that looks great in
// phone galleries, iMessage, and Instagram/Snap stories). Everything is drawn
// server-side so the output is identical on every device — and every image
// carries a small "made with KooDeck" watermark, which is the growth loop:
// a screenshot posted anywhere is an ad that links back.
//
// Pipeline: deck -> hand-built SVG (with inline twemoji so emoji render in
// color everywhere, no font needed) -> resvg rasterizes to PNG.

const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const TWEMOJI_DIR = path.dirname(require.resolve("@twemoji/svg/1f30b.svg"));

// ---------- theme palettes (mirror public/themes.css) ----------
const THEMES = {
  space:    { bg1: "#221d47", bg2: "#14112e", ink: "#f2eeff", card: "#2b2456", accent: "#ffca3a", accent2: "#8f7bff", border: "#0d0b20" },
  ocean:    { bg1: "#d8f4ff", bg2: "#8fd8ef", ink: "#083a52", card: "#ffffff", accent: "#0a84a8", accent2: "#ff8552", border: "#083a52" },
  jungle:   { bg1: "#eef8d8", bg2: "#dff2bd", ink: "#1f3d20", card: "#ffffff", accent: "#2e8b57", accent2: "#f4a428", border: "#1f3d20" },
  candy:    { bg1: "#ffe3f1", bg2: "#fff3d6", ink: "#5a1946", card: "#ffffff", accent: "#ff4fa0", accent2: "#ffb100", border: "#5a1946" },
  comic:    { bg1: "#ffd400", bg2: "#ffd400", ink: "#16161a", card: "#ffffff", accent: "#ff3d3d", accent2: "#1f7bff", border: "#16161a" },
  notebook: { bg1: "#fffdf5", bg2: "#eef5ff", ink: "#23324d", card: "#ffffff", accent: "#e0524d", accent2: "#3d7bd9", border: "#23324d" },
};

const W = 1080;         // poster width (px, 4:5-ish for social)
const PAD = 64;         // outer padding
const CONTENT_W = W - PAD * 2;
const FONT = "'Nunito','Baloo 2','DejaVu Sans','Arial',sans-serif"; // resvg falls back to a system sans

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------- emoji -> inline twemoji SVG ----------
// Turn a string that may contain an emoji into the twemoji codepoint filename.
function emojiCodepoint(str) {
  if (!str) return null;
  const cps = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x1f000 || (cp >= 0x2190 && cp <= 0x2bff) || (cp >= 0x1f1e6 && cp <= 0x1f1ff)) {
      cps.push(cp.toString(16));
    }
  }
  if (!cps.length) return null;
  // Try the full sequence first, then fall back to the first codepoint.
  const candidates = [cps.join("-"), cps.filter((c) => c !== "fe0f").join("-"), cps[0]];
  for (const name of candidates) {
    const p = path.join(TWEMOJI_DIR, name + ".svg");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const emojiCache = new Map();
function emojiInline(emojiStr, x, y, size) {
  const file = emojiCodepoint(emojiStr);
  if (!file) return "";
  let body = emojiCache.get(file);
  if (body === undefined) {
    try {
      body = fs.readFileSync(file, "utf8")
        .replace(/<\?xml[^>]*\?>/, "")
        .replace(/<svg /, `<svg x="${x}" y="${y}" width="${size}" height="${size}" `);
    } catch { body = ""; }
    emojiCache.set(file, body);
    return body;
  }
  // Re-position a cached body.
  return body.replace(/<svg [^>]*?(viewBox=)/, `<svg x="${x}" y="${y}" width="${size}" height="${size}" $1`);
}

// ---------- text wrapping (SVG has no auto-wrap) ----------
// Approximate character width so we can wrap at word boundaries. Tuned for a
// bold sans-serif; slightly generous so lines never overflow the card.
function wrapText(text, maxWidth, fontSize, weight = 400) {
  const avg = fontSize * (weight >= 700 ? 0.62 : 0.55);
  const maxChars = Math.max(6, Math.floor(maxWidth / avg));
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (!line.length) { line = w; continue; }
    if ((line + " " + w).length <= maxChars) line += " " + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function tspans(lines, x, startY, lineH) {
  return lines
    .map((ln, i) => `<tspan x="${x}" y="${startY + i * lineH}">${esc(ln)}</tspan>`)
    .join("");
}

// ---------- card builders ----------
// Each returns { height, svg } given a y offset. Cards are rounded panels.
function cardShell(t, x, y, w, h, badge, emoji) {
  const badgeW = badge ? 24 + badge.length * 11 : 0;
  return {
    open: `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="${t.card}" stroke="${t.border}" stroke-width="4"/>
      ${badge ? `
        <rect x="${x + 28}" y="${y - 20}" width="${badgeW}" height="40" rx="20" fill="${t.accent}" stroke="${t.border}" stroke-width="3"/>
        ${emoji ? emojiInline(emoji, x + 36, y - 15, 30) : ""}
        <text x="${x + 36 + (emoji ? 34 : 0)}" y="${y + 6}" font-family="${FONT}" font-size="19" font-weight="800" fill="#ffffff">${esc(badge)}</text>
      ` : ""}`,
    close: `</g>`,
    badgeW,
  };
}

function measureCard(card, t) {
  const innerW = CONTENT_W - 56;
  let bodyH = 0;
  const bigFont = 34, pFont = 26, lh = 1.35;
  if (card.type === "big_idea") {
    bodyH = wrapText(card.text, innerW, bigFont, 700).length * bigFont * lh;
  } else if (card.type === "list") {
    for (const item of card.items) {
      const label = item.label ? item.label + " — " : "";
      bodyH += wrapText(label + item.body, innerW - 30, pFont, 500).length * pFont * lh + 14;
    }
  } else if (card.type === "numbers") {
    bodyH = Math.ceil(card.items.length / 2) * 96;
  } else { // paragraph (fun_fact, takeaway)
    bodyH = wrapText(card.text, innerW, pFont, 600).length * pFont * lh;
  }
  return Math.round(bodyH + 84);
}

function buildCardSvg(card, t, x, y, w) {
  const innerX = x + 28;
  const innerW = w - 56;
  const h = measureCard(card, t);
  const shell = cardShell(t, x, y, w, h, card.badge, card.emoji);
  let inner = "";
  const topY = y + 52;

  if (card.type === "big_idea") {
    const f = 34, lh = f * 1.35;
    const lines = wrapText(card.text, innerW, f, 700);
    inner = `<text font-family="${FONT}" font-size="${f}" font-weight="800" fill="${t.ink}">${tspans(lines, innerX, topY + 4, lh)}</text>`;
  } else if (card.type === "list") {
    const f = 26, lh = f * 1.35;
    let cy = topY;
    for (const item of card.items) {
      const label = item.label ? esc(item.label) + " — " : "";
      const lines = wrapText((item.label ? item.label + " — " : "") + item.body, innerW - 30, f, 500);
      // bullet
      inner += `<rect x="${innerX}" y="${cy - 16}" width="14" height="14" rx="3" fill="${t.accent}" stroke="${t.border}" stroke-width="2" transform="rotate(45 ${innerX + 7} ${cy - 9})"/>`;
      inner += `<text font-family="${FONT}" font-size="${f}" font-weight="600" fill="${t.ink}">`;
      inner += lines.map((ln, i) => `<tspan x="${innerX + 30}" y="${cy + i * lh}">${esc(ln)}</tspan>`).join("");
      inner += `</text>`;
      cy += lines.length * lh + 14;
    }
  } else if (card.type === "numbers") {
    let cx = innerX, cy = topY - 8, col = 0;
    const chipW = (innerW - 20) / 2;
    for (const n of card.items) {
      const bx = innerX + col * (chipW + 20);
      inner += `<rect x="${bx}" y="${cy}" width="${chipW}" height="80" rx="16" fill="none" stroke="${t.border}" stroke-width="2.5" stroke-dasharray="7 6"/>`;
      inner += `<text x="${bx + chipW / 2}" y="${cy + 40}" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="800" fill="${t.accent}">${esc(n.value)}</text>`;
      const meaning = wrapText(n.meaning, chipW - 20, 16, 600)[0];
      inner += `<text x="${bx + chipW / 2}" y="${cy + 66}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="${t.ink}" opacity="0.8">${esc(meaning)}</text>`;
      col++;
      if (col === 2) { col = 0; cy += 96; }
    }
  } else {
    const f = 26, lh = f * 1.35;
    const lines = wrapText(card.text, innerW, f, 600);
    inner = `<text font-family="${FONT}" font-size="${f}" font-weight="600" fill="${t.ink}">${tspans(lines, innerX, topY, lh)}</text>`;
  }
  return { height: h, svg: shell.open + inner + shell.close };
}

// ---------- assemble the deck into cards ----------
function deckToCards(deck) {
  const s = deck.substance || {};
  const cards = [];
  if (s.big_idea) cards.push({ type: "big_idea", text: s.big_idea, badge: "Big idea", emoji: "💡" });
  if ((s.key_points || []).length)
    cards.push({ type: "list", items: s.key_points.map((p) => ({ label: p.title, body: p.detail })), badge: "Key ideas", emoji: "🔑" });
  if ((s.steps || []).length)
    cards.push({ type: "list", items: s.steps.map((p, i) => ({ label: (i + 1) + ". " + p.title, body: p.detail })), badge: "How to", emoji: "🔁" });
  if ((s.numbers || []).length)
    cards.push({ type: "numbers", items: s.numbers.slice(0, 4), badge: "By the numbers", emoji: "🔢" });
  if ((s.vocab || []).length)
    cards.push({ type: "list", items: s.vocab.map((v) => ({ label: v.word, body: v.kid_definition })), badge: "Words to know", emoji: "📚" });
  if (s.fun_fact) cards.push({ type: "paragraph", text: s.fun_fact, badge: "Fun fact", emoji: "🤯" });
  if (s.takeaway) cards.push({ type: "paragraph", text: s.takeaway, badge: "Remember this", emoji: "🎒" });
  return cards;
}

// ---------- top-level SVG ----------
function buildDeckSvg(deck) {
  const t = THEMES[deck.theme] || THEMES.space;
  const title = deck.title || (deck.layout && deck.layout.headline) || "My Deck";
  const subhead = (deck.layout && deck.layout.subhead) || "";
  const heroEmoji = (deck.layout && deck.layout.hero_emoji) || "✨";

  // Header block
  const titleLines = wrapText(title, CONTENT_W - 40, 56, 800);
  const subLines = subhead ? wrapText(subhead, CONTENT_W - 40, 26, 600) : [];
  let headerH = 120 /*emoji*/ + titleLines.length * 66 + (subLines.length ? subLines.length * 34 + 12 : 0) + (deck.authorName ? 46 : 0);
  let y = PAD + headerH + 40;

  // Cards
  const cards = deckToCards(deck);
  const cardSvgs = [];
  for (const c of cards) {
    const built = buildCardSvg(c, t, PAD, y, CONTENT_W);
    cardSvgs.push(built.svg);
    y += built.height + 34;
  }

  const footerH = 90;
  const H = Math.round(y + footerH);

  // Header SVG
  const emojiSize = 96;
  let header = "";
  header += emojiInline(heroEmoji, W / 2 - emojiSize / 2, PAD, emojiSize);
  let hy = PAD + emojiSize + 58;
  header += `<text text-anchor="middle" font-family="${FONT}" font-size="56" font-weight="800" fill="${t.ink}">${tspans(titleLines, W / 2, hy, 66)}</text>`;
  hy += (titleLines.length - 1) * 66 + 40;
  if (subLines.length) {
    header += `<text text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="600" fill="${t.ink}" opacity="0.85">${tspans(subLines, W / 2, hy, 34)}</text>`;
    hy += (subLines.length - 1) * 34 + 30;
  }
  if (deck.authorName) {
    const bw = 90 + deck.authorName.length * 12;
    header += `<rect x="${W / 2 - bw / 2}" y="${hy}" width="${bw}" height="40" rx="20" fill="${t.card}" stroke="${t.border}" stroke-width="3"/>`;
    header += `<text x="${W / 2}" y="${hy + 27}" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="800" fill="${t.ink}">made by ${esc(deck.authorName)}</text>`;
  }

  // Footer watermark — the growth loop.
  const fy = H - 52;
  const footer =
    `<text x="${W / 2}" y="${fy}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="${t.ink}" opacity="0.85">` +
    `▶ made with KooDeck · koodeck.com</text>`;

  const bg =
    deck.theme === "comic"
      ? `<rect width="${W}" height="${H}" fill="${t.bg1}"/>`
      : `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg}
    ${header}
    ${cardSvgs.join("\n")}
    ${footer}
  </svg>`;
}

function renderPng(deck, scale = 2) {
  const svg = buildDeckSvg(deck);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W * scale },
    font: { loadSystemFonts: true },
    background: "rgba(255,255,255,0)",
  });
  return resvg.render().asPng();
}

module.exports = { buildDeckSvg, renderPng, THEMES };
