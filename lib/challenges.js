// lib/challenges.js
// File-based storage for Daily Dash "beat my score" links — one JSON file per
// challenge, same beginner-friendly pattern as deck storage.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const CH_DIR = path.join(DATA_DIR, "challenges");
fs.mkdirSync(CH_DIR, { recursive: true });

const WORDS1 = ["turbo", "mega", "hyper", "super", "ultra", "power", "rocket", "lightning", "blazing", "cosmic"];
const WORDS2 = ["dash", "sprint", "blitz", "rush", "zoom", "bolt", "flash", "burst", "streak", "charge"];

function makeSlug() {
  const a = WORDS1[crypto.randomInt(WORDS1.length)];
  const b = WORDS2[crypto.randomInt(WORDS2.length)];
  return `${a}-${b}-${crypto.randomInt(1000, 9999)}`;
}

function chPath(slug) {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  return path.join(CH_DIR, `${slug}.json`);
}

function saveChallenge(data) {
  let slug = makeSlug();
  while (fs.existsSync(chPath(slug))) slug = makeSlug();
  const record = { ...data, slug, createdAt: new Date().toISOString() };
  fs.writeFileSync(chPath(slug), JSON.stringify(record, null, 2), "utf8");
  return record;
}

function getChallenge(slug) {
  const p = chPath(slug);
  if (!p || !fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

module.exports = { saveChallenge, getChallenge };
