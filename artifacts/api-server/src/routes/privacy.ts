import { Router } from "express";

const router = Router();

router.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Owmo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: #1a1a2e;
      background: #f9fafb;
      padding: 0;
    }
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: 48px 24px 80px;
      background: #fff;
      min-height: 100vh;
    }
    header {
      margin-bottom: 40px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 24px;
    }
    header .brand {
      font-size: 22px;
      font-weight: 700;
      color: #6366f1;
      letter-spacing: -0.5px;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-top: 8px;
      color: #111827;
    }
    .updated {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 36px;
      margin-bottom: 10px;
      color: #111827;
    }
    p { margin-bottom: 14px; color: #374151; }
    ul { margin: 0 0 14px 20px; color: #374151; }
    ul li { margin-bottom: 6px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 20px;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
    }
    th { background: #f3f4f6; font-weight: 600; color: #111827; }
    td { color: #374151; }
    a { color: #6366f1; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .note {
      background: #f0f9ff;
      border-left: 3px solid #6366f1;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 14px;
      font-size: 14px;
      color: #374151;
    }
    footer {
      margin-top: 56px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand">Owmo</div>
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: July 4, 2026</p>
  </header>

  <p>
    Owmo ("we", "our", or "us") is a bill-splitting app that helps groups of people split costs after shared outings. This Privacy Policy explains what personal information we collect, why we collect it, and how you can control or delete it.
  </p>

  <div class="note">
    Owmo does not process payments, store card numbers, or hold any money. All payments happen directly between users through Venmo, Cash App, or Zelle.
  </div>

  <h2>1. Information We Collect</h2>

  <h2 style="font-size:15px; margin-top:20px;">Account &amp; Identity</h2>
  <ul>
    <li><strong>Name / display name</strong> — entered by you during account setup or profile editing.</li>
    <li><strong>@handle</strong> — a public username you choose; used so other users can find and invite you.</li>
    <li><strong>Email address</strong> — collected through our authentication provider (Clerk) when you sign up or sign in.</li>
    <li><strong>Bio</strong> — an optional free-text description you can add to your profile.</li>
    <li><strong>Profile photo</strong> — an optional photo you upload. Stored in Replit Object Storage.</li>
    <li><strong>Authentication credentials</strong> — managed entirely by Clerk. We never see or store your password.</li>
  </ul>

  <h2 style="font-size:15px; margin-top:20px;">Payment Handles</h2>
  <ul>
    <li><strong>Venmo username, Cash App $cashtag, and/or Zelle email or phone number</strong> — optionally provided so event participants can send payment to you. Stored as plain text. These are never used to charge you; they are displayed to participants in events you host.</li>
  </ul>

  <h2 style="font-size:15px; margin-top:20px;">Phone Number (Optional)</h2>
  <ul>
    <li>If you choose to enable contact recognition, you can enter your phone number. <strong>We never store your raw phone number.</strong> It is hashed on your device using SHA-256, and only the hash is sent to our servers. The hash is used to match you with contacts who are already on Owmo — we cannot reverse it back to a phone number.</li>
  </ul>

  <h2 style="font-size:15px; margin-top:20px;">Event &amp; Activity Data</h2>
  <ul>
    <li><strong>Event details</strong> — name, date, time, and any venue or restaurant information associated with an event you create or join.</li>
    <li><strong>Participant list</strong> — who joined an event via an invite link or was added by the host.</li>
    <li><strong>Chat messages</strong> — messages sent in the in-app event chat are stored and visible to all event participants.</li>
    <li><strong>Receipt photos</strong> — photos of receipts uploaded by the event host. Stored in Replit Object Storage and processed by OpenAI's GPT-4o mini to extract line items.</li>
    <li><strong>Bill line items and assignments</strong> — which items each participant is assigned to, used to calculate how much each person owes.</li>
    <li><strong>Payment request records</strong> — who owes what amount and whether it has been marked as paid. No bank or card data is included.</li>
  </ul>

  <h2 style="font-size:15px; margin-top:20px;">Device &amp; Usage Data</h2>
  <ul>
    <li><strong>Push notification tokens</strong> — an Expo push token issued by your device, used to send you event notifications. You can disable notifications in your device settings at any time.</li>
    <li><strong>Location</strong> — requested only when you tap "Use my location" in the venue search. Used to bias restaurant search results. Not logged or stored by us.</li>
    <li><strong>Contacts</strong> — accessed on-device only when you choose to find friends on Owmo. Phone numbers are hashed locally (SHA-256) and the hashes are sent to our server for matching. We never upload your contacts list or store raw contact data.</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>Authenticate your account and keep it secure.</li>
    <li>Display your profile to other Owmo users (name, handle, avatar).</li>
    <li>Show your payment handles to participants in events you host so they can pay you.</li>
    <li>Calculate how much each participant owes based on receipt data and item assignments.</li>
    <li>Send you push notifications about event activity (payment requests, invitations, venue voting).</li>
    <li>Suggest mutual contacts who are already using Owmo.</li>
    <li>Improve the reliability and quality of our receipt scanning service (error logs are retained for 30 days).</li>
  </ul>

  <h2>3. Third-Party Services</h2>
  <table>
    <tr><th>Service</th><th>What it receives</th><th>Privacy policy</th></tr>
    <tr>
      <td>Clerk</td>
      <td>Email address, authentication tokens, session metadata</td>
      <td><a href="https://clerk.com/privacy" target="_blank">clerk.com/privacy</a></td>
    </tr>
    <tr>
      <td>Google Places API</td>
      <td>Venue search text; optionally your device location</td>
      <td><a href="https://policies.google.com/privacy" target="_blank">policies.google.com/privacy</a></td>
    </tr>
    <tr>
      <td>OpenAI</td>
      <td>Receipt photo images, for OCR text extraction only</td>
      <td><a href="https://openai.com/policies/privacy-policy" target="_blank">openai.com/policies/privacy-policy</a></td>
    </tr>
    <tr>
      <td>Replit Object Storage</td>
      <td>Receipt photos and profile avatar images</td>
      <td><a href="https://replit.com/privacy" target="_blank">replit.com/privacy</a></td>
    </tr>
    <tr>
      <td>Expo / EAS</td>
      <td>Push notification tokens; basic app telemetry</td>
      <td><a href="https://expo.dev/privacy" target="_blank">expo.dev/privacy</a></td>
    </tr>
  </table>

  <h2>4. Data Sharing</h2>
  <p>We do not sell your personal data. We do not share your data with advertisers or data brokers. We share data only with the third-party services listed above, and only to the extent necessary to operate the app.</p>
  <p>Within Owmo, your name, @handle, and avatar are visible to other users. Your payment handles are visible only to participants of events you host.</p>

  <h2>5. Data Retention</h2>
  <ul>
    <li>Account and profile data is retained until you delete your account.</li>
    <li>Event data, receipt photos, and chat messages are retained as long as the event exists. Hosts can delete events at any time.</li>
    <li>Scan error logs are retained for up to 30 days for reliability monitoring.</li>
    <li>Push tokens are removed when you delete your account or uninstall the app.</li>
    <li>Your hashed phone number is removed when you delete your account or remove it from your profile.</li>
  </ul>

  <h2>6. Your Rights &amp; Choices</h2>
  <ul>
    <li><strong>Access &amp; correction</strong> — You can view and update your profile information at any time in the app.</li>
    <li><strong>Delete your account</strong> — You can permanently delete your account from the Profile screen inside the app. This removes your profile, payment handles, phone hash, push tokens, friendships, and event memberships from our servers, and deletes your Clerk authentication account. Hosted events may retain anonymized records.</li>
    <li><strong>Push notifications</strong> — You can disable push notifications in your device settings at any time.</li>
    <li><strong>Location</strong> — Location access is always optional. You can deny or revoke location permission in your device settings.</li>
    <li><strong>Contacts</strong> — Contact access is always optional. You can deny or revoke contacts permission in your device settings at any time.</li>
  </ul>

  <h2>7. Children's Privacy</h2>
  <p>Owmo is not directed to children under 13. We do not knowingly collect personal information from anyone under 13. If you believe a child under 13 has provided us with personal information, please contact us and we will delete it.</p>

  <h2>8. Security</h2>
  <p>We use industry-standard HTTPS encryption for all data in transit. Authentication is handled by Clerk, which implements secure session management and token rotation. Phone numbers are never stored — only their SHA-256 hash is retained.</p>

  <h2>9. Changes to This Policy</h2>
  <p>We may update this policy from time to time. If we make material changes, we will notify you through the app or by email. The "Last updated" date at the top reflects the most recent revision.</p>

  <h2>10. Contact Us</h2>
  <p>If you have questions about this privacy policy or want to request data deletion:</p>
  <ul>
    <li><strong>In the app:</strong> go to Profile → Delete account to instantly remove all your data.</li>
    <li><strong>Web form:</strong> <a href="/api/data-deletion">Submit a data deletion request</a> — we'll process it within 30 days.</li>
    <li><strong>Email:</strong> <a href="mailto:privacy@owmo.app">privacy@owmo.app</a></li>
  </ul>

  <footer>
    &copy; 2026 Owmo &nbsp;·&nbsp; <a href="mailto:privacy@owmo.app">privacy@owmo.app</a>
  </footer>
</div>
</body>
</html>`);
});

export default router;
