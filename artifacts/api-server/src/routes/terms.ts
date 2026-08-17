import { Router } from "express";

const router = Router();

router.get("/terms", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service — Owmo</title>
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
    <h1>Terms of Service</h1>
    <p class="updated">Last updated: July 4, 2026</p>
  </header>

  <p>
    These Terms of Service ("Terms") govern your use of Owmo ("the App"), a bill-splitting application operated by Owmo ("we", "our", or "us"). By downloading, installing, or using Owmo, you agree to be bound by these Terms. If you do not agree, do not use the App.
  </p>

  <h2>1. Eligibility</h2>
  <p>You must be at least 13 years old to use Owmo. By using the App, you represent that you meet this requirement. If you are between 13 and 18, you represent that your parent or legal guardian has reviewed and agreed to these Terms on your behalf.</p>

  <h2>2. Acceptable Use</h2>
  <p>You agree to use Owmo only for lawful purposes and in a manner consistent with these Terms. You must not:</p>
  <ul>
    <li>Use the App to harass, threaten, or harm other users.</li>
    <li>Upload or share content that is illegal, defamatory, obscene, or infringes any third-party rights.</li>
    <li>Attempt to gain unauthorized access to the App, our servers, or other users' accounts.</li>
    <li>Use automated tools, bots, or scripts to scrape or interact with the App without our written permission.</li>
    <li>Reverse engineer, decompile, or disassemble any part of the App.</li>
    <li>Use the App to facilitate fraud, money laundering, or any other illegal financial activity.</li>
    <li>Impersonate any person or entity, or falsely represent your affiliation with any person or entity.</li>
    <li>Transmit malware, viruses, or any other harmful code.</li>
  </ul>

  <div class="note">
    Owmo does not process payments, hold funds, or act as a payment intermediary. All money movement happens directly between users through third-party services such as Venmo, Cash App, or Zelle, which have their own terms of service.
  </div>

  <h2>3. Accounts</h2>
  <p>To use most features of Owmo, you must create an account. You are responsible for:</p>
  <ul>
    <li>Providing accurate and complete account information.</li>
    <li>Maintaining the security of your account credentials.</li>
    <li>All activity that occurs under your account.</li>
  </ul>
  <p>You must notify us immediately if you believe your account has been compromised. We reserve the right to suspend or terminate accounts that violate these Terms.</p>

  <h2>4. User Content</h2>
  <p>You retain ownership of any content you submit to Owmo, including receipt photos, event details, and chat messages ("User Content"). By submitting User Content, you grant us a limited, non-exclusive, royalty-free license to store, process, and display that content solely to operate and provide the App's features to you and your event participants.</p>
  <p>You are solely responsible for your User Content. We do not endorse any User Content and have no obligation to monitor it. We reserve the right to remove User Content that violates these Terms.</p>

  <h2>5. Receipt Scanning &amp; AI Processing</h2>
  <p>Owmo uses OpenAI's API to extract line-item data from receipt photos you upload. By uploading a receipt, you acknowledge that the image will be transmitted to OpenAI for processing. We do not guarantee the accuracy of extracted data — always review the scanned results before finalizing a bill split.</p>

  <h2>6. Account Termination</h2>
  <p>You may delete your account at any time from the Profile screen inside the App. Upon deletion, your profile data, payment handles, friendships, and event memberships are removed from our servers.</p>
  <p>We may suspend or permanently terminate your account at our discretion, without prior notice, if we reasonably believe you have violated these Terms, engaged in fraudulent activity, or acted in a manner harmful to other users or to us. Termination does not entitle you to any refund or compensation.</p>
  <p>Upon termination, your right to use the App immediately ceases. Sections of these Terms that by their nature should survive termination will do so, including Sections 4, 7, 8, 9, and 10.</p>

  <h2>7. Disclaimers</h2>
  <p>THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
  <p>We do not warrant that:</p>
  <ul>
    <li>The App will be available, uninterrupted, or error-free at all times.</li>
    <li>Receipt scanning results will be accurate or complete.</li>
    <li>Payment information you share within the App will result in successful payment collection.</li>
  </ul>
  <p>Your use of the App, and any reliance on bill calculations or payment information displayed within it, is entirely at your own risk.</p>

  <h2>8. Limitation of Liability</h2>
  <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO YOUR USE OF THE APP.</p>
  <p>OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY CLAIMS ARISING UNDER OR RELATED TO THESE TERMS OR THE APP SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR (B) US $10.</p>

  <h2>9. Indemnification</h2>
  <p>You agree to indemnify, defend, and hold harmless Owmo and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with: (a) your access to or use of the App; (b) your User Content; (c) your violation of these Terms; or (d) your violation of any rights of another person or entity.</p>

  <h2>10. Governing Law &amp; Dispute Resolution</h2>
  <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to its conflict-of-law provisions.</p>
  <p>Any dispute arising from these Terms or your use of the App shall first be attempted to be resolved through informal negotiation by contacting us at <a href="mailto:legal@owmo.app">legal@owmo.app</a>. If the dispute is not resolved within 30 days, it shall be submitted to binding arbitration in accordance with the rules of the American Arbitration Association, conducted in English.</p>
  <p>You agree to resolve disputes with us on an individual basis and waive any right to participate in a class action lawsuit or class-wide arbitration.</p>

  <h2>11. Changes to These Terms</h2>
  <p>We may update these Terms from time to time. If we make material changes, we will notify you through the App or by email. Continued use of the App after the updated Terms take effect constitutes your acceptance of the revised Terms. The "Last updated" date at the top reflects the most recent revision.</p>

  <h2>12. Third-Party Services</h2>
  <p>The App integrates with third-party services including Clerk (authentication), Google Places API (venue search), OpenAI (receipt scanning), Replit Object Storage (file storage), and Expo (push notifications). Your use of those services is subject to their respective terms of service and privacy policies. We are not responsible for the practices of those third parties.</p>

  <h2>13. Contact Us</h2>
  <p>If you have questions about these Terms, contact us at:</p>
  <p><a href="mailto:legal@owmo.app">legal@owmo.app</a></p>

  <footer>
    &copy; 2026 Owmo &nbsp;·&nbsp; <a href="/api/privacy">Privacy Policy</a> &nbsp;·&nbsp; <a href="mailto:legal@owmo.app">legal@owmo.app</a>
  </footer>
</div>
</body>
</html>`);
});

export default router;
