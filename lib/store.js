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
  return deck;
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

module.exports = { saveDeck, getDeck, updateDeck, seedDeck };
