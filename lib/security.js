// lib/security.js
// Bot/spam protection layers. Everything here degrades gracefully:
//  - Turnstile (Cloudflare's free CAPTCHA) only activates when its env keys
//    are set (TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY). Without them the
//    site works exactly as before.
//  - The honeypot needs no configuration at all.
//  - Security headers are always on.

// ---------- security headers ----------
// A pragmatic Content-Security-Policy: allows this site, Google Fonts,
// YouTube thumbnails, and Cloudflare Turnstile — blocks everything else.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https://i.ytimg.com",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

function securityHeaders(_req, res, next) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  next();
}

// ---------- client IP (Cloudflare-aware) ----------
// Behind Cloudflare, the visitor's real IP arrives in CF-Connecting-IP.
// Behind Render/Railway alone, it's the first entry of X-Forwarded-For.
// Getting this right is what makes the rate limits bite the right client.
function getClientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).trim();
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.ip || "unknown";
}

// ---------- honeypot ----------
// The forms include an invisible "website" field. Humans never see it;
// form-filling bots fill it. If it arrives non-empty, it's a bot.
function honeypotHit(body) {
  return typeof body === "object" && body !== null && String(body.website || "").trim() !== "";
}

// ---------- Cloudflare Turnstile ----------
// Server-side check of the token the widget produced in the browser.
// If no secret is configured, verification is skipped (feature off).
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY);
}

async function verifyTurnstile(token, ip) {
  if (!turnstileEnabled()) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: "missing-token" };
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: String(token).slice(0, 2048),
        remoteip: ip,
      }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => ({}));
    return data.success ? { ok: true } : { ok: false, reason: "failed" };
  } catch (e) {
    // If Cloudflare itself is unreachable, fail open so the site keeps
    // working — the honeypot and rate limits still stand behind it.
    return { ok: true, skipped: true, reason: "verify-unreachable" };
  }
}

module.exports = { securityHeaders, getClientIp, honeypotHit, verifyTurnstile, turnstileEnabled };
