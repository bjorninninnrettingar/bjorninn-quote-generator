// api/version.js
// Returns the currently-deployed git commit SHA so long-lived kiosk tabs
// (stimpilklukka.html) can notice a new deploy and reload themselves instead
// of running stale JavaScript for days. Vercel injects VERCEL_GIT_COMMIT_SHA
// into the function environment at deploy time — nothing to bump by hand.

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).json({ version: process.env.VERCEL_GIT_COMMIT_SHA || "dev" });
}
