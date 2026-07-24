#!/usr/bin/env node
// reset-link.js — generate a password-reset link for a user WITHOUT needing any
// email provider. Give the printed link to the user (over any channel you trust);
// it lets them set a new password. The link expires in 1 hour and is single-use.
//
// Usage:
//   node scripts/reset-link.js teacher@school.edu
//   SITE_URL=https://koodeck.com node scripts/reset-link.js teacher@school.edu
//
// SITE_URL should be your live address (defaults to https://koodeck.com). This
// is the reliable fallback when you haven't set up email (RESEND_API_KEY).

const auth = require("../lib/auth");

const email = process.argv[2];
const siteUrl = (process.env.SITE_URL || "https://koodeck.com").replace(/\/+$/, "");

if (!email) {
  console.log("Usage: node scripts/reset-link.js <email>");
  console.log("       SITE_URL=https://your-site node scripts/reset-link.js <email>");
  process.exit(1);
}
if (!auth.validEmail(email)) {
  console.error("That doesn't look like a valid email address.");
  process.exit(1);
}
if (!auth.getUser(email)) {
  console.error(`No account found for ${email}. They must sign up first.`);
  process.exit(1);
}

const token = auth.createResetToken(email);
if (!token) {
  console.error("Could not create a reset token (no such user?).");
  process.exit(1);
}

const link = `${siteUrl}/reset?token=${encodeURIComponent(token)}`;
console.log("");
console.log("Password-reset link for " + email + ":");
console.log("");
console.log("  " + link);
console.log("");
console.log("Give this link to the user. It expires in 1 hour and works once.");
console.log("(If your site isn't at " + siteUrl + ", re-run with SITE_URL=https://your-address)");
