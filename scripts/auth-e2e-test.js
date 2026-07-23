// End-to-end verification of the signup/auth fixes:
//  - Turnstile renders on signup when keys are set (and enforces on submit)
//  - full password-reset cycle: request -> token -> set new password -> log in
//  - "Forgot password?" link present on login
process.env.PORT = "4010";
process.env.DATA_DIR = "/tmp/e2e-auth-" + Date.now();
process.env.SESSION_SECRET = "t";
process.env.ANTHROPIC_API_KEY = "k";
process.env.TURNSTILE_SITE_KEY = "0xTEST_SITEKEY";
process.env.TURNSTILE_SECRET_KEY = "0xTEST_SECRET";

const realFetch = global.fetch;
// Capture the reset link the server logs (no email provider configured in test).
let capturedLink = null;
const origLog = console.log;
console.log = function (...a) {
  const s = a.join(" ");
  const m = s.match(/reset\?token=([^\s]+)/);
  if (m) capturedLink = s.slice(s.indexOf("http"));
  origLog.apply(console, a);
};
// Mock Cloudflare's siteverify so a "good" token passes, others fail.
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("localhost")) return realFetch(url, opts);
  if (u.includes("siteverify")) {
    const body = String(opts.body || "");
    const ok = body.includes("good-token");
    return new Response(JSON.stringify({ success: ok }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("api.resend.com")) return new Response("{}", { status: 200 }); // not used (no key set)
  return new Response("no", { status: 404 });
};

require("../server.js");
const B = "http://localhost:4010";
let pass = 0, fail = 0;
const t = (n, c) => { if (c) { pass++; console.error("  OK  " + n); } else { fail++; console.error("  XX  " + n); } };
const post = (p, b, cookie) => realFetch(B + p, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(b) });

setTimeout(async () => {
  // 1) TURNSTILE ON SIGNUP: the page carries the real sitekey (bug was: placeholder never filled)
  const loginPage = await (await realFetch(B + "/login")).text();
  t("signup/login page renders real Turnstile sitekey", loginPage.includes("0xTEST_SITEKEY") && !loginPage.includes("{{TS_KEY}}"));
  t("login page has the Turnstile mount + loader", /challenges\.cloudflare\.com\/turnstile/.test(loginPage) && /ts-box/.test(loginPage));
  t("login page shows a 'Forgot password?' link to /reset", /href="\/reset"/.test(loginPage) && /Forgot password/.test(loginPage));

  // 2) Turnstile ENFORCED on register: bad/no token rejected, good token accepted
  const badReg = await post("/api/auth/register", { email: "a@b.com", password: "password123", turnstileToken: "bad" });
  t("register rejected without valid Turnstile token (403)", badReg.status === 403);
  const goodReg = await post("/api/auth/register", { email: "teach@school.edu", password: "password123", turnstileToken: "good-token" });
  t("register succeeds with valid Turnstile token", goodReg.status === 200);

  // 3) PASSWORD RESET — request phase
  const reqReset = await post("/api/auth/request-reset", { email: "teach@school.edu", turnstileToken: "good-token" });
  const reqJson = await reqReset.json();
  t("request-reset returns generic success", reqReset.status === 200 && reqJson.ok);
  // give the async log a beat
  await new Promise((r) => setTimeout(r, 100));
  t("a reset link/token was generated", !!capturedLink && /token=/.test(capturedLink));
  t("request-reset for UNKNOWN email also returns generic success (no enumeration)",
    (await (await post("/api/auth/request-reset", { email: "nobody@nowhere.com", turnstileToken: "good-token" })).json()).ok === true);
  t("request-reset requires Turnstile (bad token 403)", (await post("/api/auth/request-reset", { email: "teach@school.edu", turnstileToken: "bad" })).status === 403);

  // 4) PASSWORD RESET — consume the token, set a new password
  const token = decodeURIComponent(capturedLink.split("token=")[1]);
  const badPw = await post("/api/auth/reset", { token, password: "short" });
  t("reset rejects a too-short password", badPw.status === 400);
  const doReset = await post("/api/auth/reset", { token, password: "brandNewPass1" });
  t("reset with valid token + good password succeeds", doReset.status === 200);
  t("reset logs the user in (sets session cookie)", !!doReset.headers.get("set-cookie"));

  // 5) Token is single-use / new password works, old fails
  t("token can't be reused (already consumed)", (await post("/api/auth/reset", { token, password: "anotherPass9" })).status === 400);
  t("old password no longer works", (await post("/api/auth/login", { email: "teach@school.edu", password: "password123" })).status === 401);
  t("new password works for login", (await post("/api/auth/login", { email: "teach@school.edu", password: "brandNewPass1" })).status === 200);

  // 6) The /reset page itself renders both views
  const resetPage = await (await realFetch(B + "/reset")).text();
  t("/reset page serves and has request + set-new-password views", resetPage.includes("request-view") && resetPage.includes("reset-view"));
  t("/es/reset serves in Spanish", (await (await realFetch(B + "/es/reset")).text()).includes("contraseña"));

  console.error(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 1400);
