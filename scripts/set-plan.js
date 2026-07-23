#!/usr/bin/env node
// set-plan.js — manually change a user's plan (used with Stripe Path A, or support).
// Usage:  node scripts/set-plan.js user@example.com paid 365
//         node scripts/set-plan.js user@example.com free
// The third argument (days) is how long "paid" lasts; omit for no expiry.

const auth = require("../lib/auth");
const [, , email, plan = "paid", days] = process.argv;

if (!email) {
  console.log("Usage: node scripts/set-plan.js <email> <paid|free> [days]");
  process.exit(1);
}
if (!auth.getUser(email)) {
  console.error(`No account found for ${email}. They must sign up first.`);
  process.exit(1);
}
let until = null;
if (plan === "paid" && days) {
  const d = new Date();
  d.setDate(d.getDate() + parseInt(days, 10));
  until = d.toISOString();
}
auth.setPlan(email, plan, until);
const u = auth.getUser(email);
console.log(`✔ ${email} is now: ${auth.effectivePlan(u)}${until ? " until " + until.slice(0, 10) : ""}`);
