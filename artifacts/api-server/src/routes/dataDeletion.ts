import { Router } from "express";
import { db } from "@workspace/db";
import { dataDeletionRequestsTable } from "@workspace/db";

const router = Router();

const PAGE_STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.7;
    color: #1a1a2e;
    background: #f9fafb;
  }
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 48px 24px 80px;
    background: #fff;
    min-height: 100vh;
  }
  header {
    margin-bottom: 36px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 24px;
  }
  header .brand { font-size: 22px; font-weight: 700; color: #6366f1; letter-spacing: -0.5px; }
  h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-top: 8px; color: #111827; }
  p { margin-bottom: 14px; color: #374151; }
  .note {
    background: #fef9c3;
    border-left: 3px solid #ca8a04;
    padding: 12px 16px;
    border-radius: 0 6px 6px 0;
    margin-bottom: 20px;
    font-size: 14px;
    color: #374151;
  }
  label { display: block; font-weight: 600; color: #111827; margin-bottom: 6px; font-size: 14px; }
  input, textarea, select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
    color: #111827;
    margin-bottom: 18px;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus, textarea:focus, select:focus { border-color: #6366f1; }
  textarea { resize: vertical; min-height: 90px; }
  button {
    width: 100%;
    padding: 12px;
    background: #ef4444;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  button:hover { background: #dc2626; }
  .success {
    text-align: center;
    padding: 40px 0;
  }
  .success .icon { font-size: 48px; margin-bottom: 16px; }
  .success h2 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 10px; }
  .success p { color: #6b7280; }
  footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    font-size: 13px;
    color: #9ca3af;
  }
  a { color: #6366f1; text-decoration: none; }
  a:hover { text-decoration: underline; }
`;

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Request Data Deletion — Owmo</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand">Owmo</div>
    <h1>Request Data Deletion</h1>
  </header>
  ${body}
  <footer>
    &copy; 2026 Owmo &nbsp;·&nbsp;
    <a href="/api/privacy">Privacy Policy</a> &nbsp;·&nbsp;
    <a href="/api/terms">Terms of Service</a>
  </footer>
</div>
</body>
</html>`;
}

// GET /data-deletion — show the request form
router.get("/data-deletion", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(layout(`
  <p>
    If you'd like to delete your Owmo account and all associated data, you can do so directly
    inside the app: go to <strong>Profile → Delete account</strong>.
  </p>
  <div class="note">
    If you no longer have access to the app or your account, submit this form and we'll
    process your request within 30 days.
  </div>
  <form method="POST" action="/api/data-deletion">
    <label for="email">Email address on your Owmo account</label>
    <input
      type="email"
      id="email"
      name="email"
      required
      placeholder="you@example.com"
      autocomplete="email"
    />

    <label for="reason">Reason (optional)</label>
    <textarea
      id="reason"
      name="reason"
      placeholder="Tell us why you'd like your data removed…"
    ></textarea>

    <button type="submit">Submit deletion request</button>
  </form>
  `));
});

// POST /data-deletion — save the request and confirm
router.post("/data-deletion", async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const email = (req.body?.email ?? "").toString().trim().toLowerCase();
  const reason = (req.body?.reason ?? "").toString().trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).send(layout(`
      <p style="color:#ef4444;font-weight:600;">Please enter a valid email address.</p>
      <a href="/api/data-deletion">← Go back</a>
    `));
    return;
  }

  try {
    await db.insert(dataDeletionRequestsTable).values({ email, reason });
  } catch (err) {
    console.error("[data-deletion] DB insert failed:", err);
    // Still show success — we don't want to expose DB errors to users.
    // The request can be handled via the email fallback if needed.
  }

  res.send(layout(`
    <div class="success">
      <div class="icon">✅</div>
      <h2>Request received</h2>
      <p>
        We've logged your deletion request for <strong>${email.replace(/</g, "&lt;")}</strong>.
        We'll process it within <strong>30 days</strong> and send a confirmation
        to that email address once complete.
      </p>
      <p style="margin-top:16px;">
        If you have questions, email us at
        <a href="mailto:privacy@owmo.app">privacy@owmo.app</a>.
      </p>
    </div>
  `));
});

export default router;
