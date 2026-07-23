// lib/daily.js
// The Daily Dash: everyone in the world gets the same pack and question order
// on a given date — deterministic, no database needed. That shared experience
// is the viral core: two friends comparing today's score are playing the exact
// same five questions.

const { PACKS } = require("./packs");

// Tiny seeded PRNG (mulberry32) so "shuffle by date" is stable everywhere.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(dateStr) {
  // dateStr: "YYYY-MM-DD" (UTC)
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todayStr(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getDaily(dateStr) {
  const date = dateStr || todayStr();
  const rand = mulberry32(dateSeed(date));
  const pack = PACKS[Math.floor(rand() * PACKS.length)];
  // Shuffle question order and each question's choices deterministically,
  // tracking where the correct answer lands.
  const qs = pack.questions.map((q) => ({ ...q }));
  for (let i = qs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [qs[i], qs[j]] = [qs[j], qs[i]];
  }
  const questions = qs.map((q) => {
    const order = q.choices.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return {
      q: q.q,
      choices: order.map((i) => q.choices[i]),
      a: order.indexOf(q.a),
      fun: q.fun,
    };
  });
  return { date, packId: pack.id, title: pack.title, emoji: pack.emoji, theme: pack.theme, questions };
}

module.exports = { getDaily, todayStr };
