// lib/auth.js
// Account system for KooDeck — ADULTS ONLY (teachers/parents). Students never
// register; they open shared deck links account-less, exactly as before.
//
// Deliberately dependency-free and file-based, matching the rest of the app:
//   - passwords hashed with Node's built-in scrypt (salted, slow)
//   - sessions are HMAC-signed cookies (no server-side session store needed)
//   - one JSON file per user under data/users/, keyed by a hash of the email
//
// Plans: "free" (3 decks/day) and "paid" (unlimited). Daily usage is counted
// per-user per UTC date, stored right in the user record.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const USERS_DIR = path.join(DATA_DIR, "users");
fs.mkdirSync(USERS_DIR, { recursive: true });

const FREE_DAILY_LIMIT = 3;

// A stable secret signs session cookies. In production set SESSION_SECRET;
// otherwise we persist a random one so logins survive restarts in dev.
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, ".session-secret");
  try {
    if (fs.existsSync(f)) return fs.readFileSync(f, "utf8");
    const s = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(f, s, "utf8");
    return s;
  } catch { return "dev-insecure-secret"; }
}

const normEmail = (e) => String(e || "").trim().toLowerCase();
const emailKey = (e) => crypto.createHash("sha256").update(normEmail(e)).digest("hex");
const userPath = (e) => path.join(USERS_DIR, emailKey(e) + ".json");
const todayStr = () => new Date().toISOString().slice(0, 10);

function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(e)); }

// ---------- password hashing (scrypt) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split("$");
    if (scheme !== "scrypt") return false;
    const check = crypto.scryptSync(String(password), salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex"); const b = Buffer.from(check, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// ---------- user records ----------
function getUser(email) {
  const p = userPath(email);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}
function saveUser(u) {
  fs.writeFileSync(userPath(u.email), JSON.stringify(u, null, 2), "utf8");
  return u;
}
function createUser(email, password) {
  const e = normEmail(email);
  if (!validEmail(e)) return { error: "Please enter a valid email address." };
  if (String(password || "").length < 8) return { error: "Password must be at least 8 characters." };
  if (getUser(e)) return { error: "An account with that email already exists. Try logging in." };
  const u = {
    email: e,
    passwordHash: hashPassword(password),
    plan: "free",
    planUntil: null,
    createdAt: new Date().toISOString(),
    usage: {}, // { "YYYY-MM-DD": count }
  };
  saveUser(u);
  return { user: publicUser(u) };
}
function authenticate(email, password) {
  const u = getUser(email);
  if (!u || !verifyPassword(password, u.passwordHash)) return null;
  return u;
}
function publicUser(u) {
  return { email: u.email, plan: effectivePlan(u), remainingToday: remainingToday(u) };
}

// ---------- plans + daily usage ----------
function effectivePlan(u) {
  if (u.plan === "paid" && (!u.planUntil || new Date(u.planUntil) > new Date())) return "paid";
  return "free";
}
function usageToday(u) { return (u.usage && u.usage[todayStr()]) || 0; }
function remainingToday(u) {
  if (effectivePlan(u) === "paid") return Infinity;
  return Math.max(0, FREE_DAILY_LIMIT - usageToday(u));
}
function canCreate(u) { return remainingToday(u) > 0; }
function recordCreation(email) {
  const u = getUser(email);
  if (!u) return;
  const d = todayStr();
  u.usage = u.usage || {};
  u.usage[d] = (u.usage[d] || 0) + 1;
  // prune old days so files stay tiny
  for (const k of Object.keys(u.usage)) if (k < d) delete u.usage[k];
  saveUser(u);
}
function setPlan(email, plan, planUntil) {
  const u = getUser(email);
  if (!u) return null;
  u.plan = plan === "paid" ? "paid" : "free";
  u.planUntil = planUntil || null;
  return saveUser(u);
}

// ---------- sessions (signed cookies) ----------
function sign(value) {
  const sig = crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
  return `${value}.${sig}`;
}
function makeSessionCookie(email) {
  const value = Buffer.from(normEmail(email)).toString("base64url");
  const token = sign(value);
  // 30-day, HttpOnly, SameSite=Lax, Secure (safe behind Cloudflare/Render HTTPS)
  return `koo_session=${token}; Max-Age=${30 * 24 * 3600}; Path=/; HttpOnly; SameSite=Lax; Secure`;
}
function clearSessionCookie() {
  return "koo_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure";
}
function readSession(cookieHeader) {
  const m = /(?:^|;\s*)koo_session=([^;]+)/.exec(cookieHeader || "");
  if (!m) return null;
  const token = m[1];
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const value = token.slice(0, dot);
  if (sign(value) !== token) return null; // bad signature
  try { return Buffer.from(value, "base64url").toString("utf8"); } catch { return null; }
}
function userFromRequest(req) {
  const email = readSession(req.headers.cookie);
  if (!email) return null;
  return getUser(email);
}

module.exports = {
  FREE_DAILY_LIMIT, validEmail,
  createUser, authenticate, getUser, publicUser,
  effectivePlan, remainingToday, canCreate, recordCreation, setPlan,
  makeSessionCookie, clearSessionCookie, userFromRequest,
};
