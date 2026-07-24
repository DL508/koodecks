// lib/store.js
// A tiny file-based store for decks. Each deck is one JSON file in /data/decks.
// This keeps deployment simple (no database to set up). For heavy traffic you
// could swap this for SQLite or Postgres later without changing server.js much.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DECK_DIR = path.join(DATA_DIR, "decks");

fs.mkdirSync(DECK_DIR, { recursive: true });

// URL-safe, kid-friendly slug: adjective-animal-1234
const ADJECTIVES = ["brave","sunny","clever","mighty","cosmic","zippy","happy","super","turbo","lucky","bright","wild","swift","magic","rocket"];
const ANIMALS = ["panda","otter","falcon","tiger","dolphin","koala","dragon","fox","narwhal","gecko","puffin","cheetah","axolotl","owl","yeti"];

function makeSlug() {
  const a = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
  const b = ANIMALS[crypto.randomInt(ANIMALS.length)];
  const n = crypto.randomInt(1000, 9999);
  return `${a}-${b}-${n}`;
}

function deckPath(slug) {
  // Prevent path traversal: only allow letters, numbers, dashes
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  return path.join(DECK_DIR, `${slug}.json`);
}

function saveDeck(deck) {
  let slug = makeSlug();
  while (fs.existsSync(deckPath(slug))) slug = makeSlug();
  deck.slug = slug;
  deck.editKey = crypto.randomBytes(12).toString("base64url"); // secret: only the creator can rename
  deck.createdAt = new Date().toISOString();
  fs.writeFileSync(deckPath(slug), JSON.stringify(deck, null, 2), "utf8");
  appendIndex(deck);
  return deck;
}

// ---------- lightweight index for listing (today's decks, my decks, all dashes) ----------
// One JSON line per deck. Cheap to append on save, cheap to scan for listings.
const INDEX_FILE = path.join(DATA_DIR, "deck-index.jsonl");
function appendIndex(deck) {
  const row = {
    slug: deck.slug,
    title: deck.title || "",
    lang: deck.lang || "en",
    theme: deck.theme || "space",
    ownerEmail: deck.ownerEmail || null,   // null = anonymous ("student") creation
    isDash: !!deck.isDash,                  // a deck that's been turned into a playable dash
    heroEmoji: (deck.layout && deck.layout.hero_emoji) || "✨",
    createdAt: deck.createdAt,
  };
  try { fs.appendFileSync(INDEX_FILE, JSON.stringify(row) + "\n", "utf8"); } catch {}
}
function readIndex() {
  try {
    return fs.readFileSync(INDEX_FILE, "utf8")
      .split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}
// Latest row per slug wins (so updates like "turned into a dash" reflect correctly).
function indexBy(filterFn) {
  const rows = readIndex();
  const bySlug = new Map();
  for (const r of rows) bySlug.set(r.slug, r); // later lines overwrite earlier
  return [...bySlug.values()].filter(filterFn).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
function decksToday(lang) {
  const today = new Date().toISOString().slice(0, 10);
  return indexBy((r) => (r.createdAt || "").slice(0, 10) === today && (!lang || r.lang === lang) && !r.example);
}
function decksByOwner(email) {
  return email ? indexBy((r) => r.ownerEmail === email) : [];
}
function allDashes(lang) {
  return indexBy((r) => r.isDash && (!lang || r.lang === lang));
}

function getDeck(slug) {
  const p = deckPath(slug);
  if (!p || !fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function updateDeck(slug, patch) {
  const deck = getDeck(slug);
  if (!deck) return null;
  const updated = { ...deck, ...patch, slug };
  fs.writeFileSync(deckPath(slug), JSON.stringify(updated, null, 2), "utf8");
  appendIndex(updated); // record the new state (e.g. isDash flip, title change)
  return updated;
}

// Seed a deck at a fixed, human-friendly slug (used for the landing-page
// showcase examples). Never clobbers an existing deck of the same slug.
function seedDeck(slug, deck) {
  const p = deckPath(slug);
  if (!p) return null;
  if (fs.existsSync(p)) return getDeck(slug);
  const full = {
    ...deck,
    slug,
    editKey: crypto.randomBytes(12).toString("base64url"),
    createdAt: new Date().toISOString(),
    example: true,
  };
  fs.writeFileSync(p, JSON.stringify(full, null, 2), "utf8");
  return full;
}

module.exports = { saveDeck, getDeck, updateDeck, seedDeck, decksToday, decksByOwner, allDashes };
