#!/usr/bin/env node
// One-shot ASC setup: updates URLs, age rating, and reviewer notes
import crypto from 'crypto';

const keyId    = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const appId    = process.env.ASC_APP_ID;
const domain   = process.env.EXPO_PUBLIC_DOMAIN || 'owmo-9bwgw.replit.app';
const rawPem   = process.env.ASC_API_KEY_P8 || '';

if (!keyId || !issuerId || !appId || !rawPem) {
  console.error('Missing required env vars: ASC_KEY_ID, ASC_ISSUER_ID, ASC_APP_ID, ASC_API_KEY_P8');
  process.exit(1);
}

function normalizePem(pem) {
  pem = pem.trim();
  if (pem.includes('\n')) return pem;
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g).join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
}

function makeJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const sigInput = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(sigInput);
  const sig = sign.sign({ key: normalizePem(rawPem), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${sigInput}.${sig}`;
}

async function asc(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${makeJwt()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ASC ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

// ── 1. Get the in-review / prepare-for-submission version ──────────────────
const versionsRes = await asc('GET', `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=5`);
const version = versionsRes.data.find(v =>
  ['PREPARE_FOR_SUBMISSION', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_APPLE_RELEASE'].includes(v.attributes.appVersionState)
);
if (!version) {
  console.error('No active version found. States:', versionsRes.data.map(v => v.attributes.appVersionState));
  process.exit(1);
}
console.log(`Found version ${version.attributes.versionString} — ${version.attributes.appVersionState} (${version.id})`);

// ── 2. Privacy policy URL lives on appInfoLocalizations ───────────────────
const appInfosRes = await asc('GET', `/v1/apps/${appId}/appInfos`);
const appInfo = appInfosRes.data[0];
const appInfoLocsRes = await asc('GET', `/v1/appInfos/${appInfo.id}/appInfoLocalizations?filter[locale]=en-US`);
const appInfoLoc = appInfoLocsRes.data[0];
await asc('PATCH', `/v1/appInfoLocalizations/${appInfoLoc.id}`, {
  data: {
    type: 'appInfoLocalizations',
    id: appInfoLoc.id,
    attributes: {
      privacyPolicyUrl: `https://${domain}/api/privacy`,
    },
  },
});
console.log(`✓ Privacy policy URL → https://${domain}/api/privacy`);

// ── 3. Support URL lives on appStoreVersionLocalizations ──────────────────
// (handled below in step 5 alongside description/keywords)

// ── 4. Age rating declaration — all None/No ────────────────────────────────
const ageRes = await asc('GET', `/v1/appInfos/${appInfo.id}/ageRatingDeclaration`);
const ageId = ageRes.data.id;
await asc('PATCH', `/v1/ageRatingDeclarations/${ageId}`, {
  data: {
    type: 'ageRatingDeclarations',
    id: ageId,
    attributes: {
      // String enums
      alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      contests: 'NONE',
      gamblingSimulated: 'NONE',
      gunsOrOtherWeapons: 'NONE',
      medicalOrTreatmentInformation: 'NONE',
      profanityOrCrudeHumor: 'NONE',
      sexualContentGraphicAndNudity: 'NONE',
      sexualContentOrNudity: 'NONE',
      horrorOrFearThemes: 'NONE',
      matureOrSuggestiveThemes: 'NONE',
      violenceCartoonOrFantasy: 'NONE',
      violenceRealistic: 'NONE',
      violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      // Booleans
      gambling: false,
      healthOrWellnessTopics: false,
      lootBox: false,
      messagingAndChat: true,
      unrestrictedWebAccess: false,
      userGeneratedContent: false,
      parentalControls: false,
      advertising: false,
      ageAssurance: false,
    },
  },
});
console.log('✓ Age rating → 4+');

// ── 5. Reviewer notes + test account ──────────────────────────────────────
const locRes = await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
const locId = locRes.data.find(l => l.attributes.locale === 'en-US')?.id;
if (locId) {
  await asc('PATCH', `/v1/appStoreVersionLocalizations/${locId}`, {
    data: {
      type: 'appStoreVersionLocalizations',
      id: locId,
      attributes: {
        supportUrl: `https://${domain}`,
        keywords: 'bill splitter,dinner planner,split bills,group dining,expense split,tab splitter,restaurant,friends',
        description: `Owmo makes group dining effortless — from choosing where to eat to splitting the bill at the end of the night.

PLAN TOGETHER
Create an event, invite friends, and pick a restaurant from real nearby options. No more endless "what are you feeling?" texts. Owmo surfaces restaurants with ratings, distance, and price range so your group can decide in seconds.

INVITE YOUR CREW
Add friends by @handle, find people from your contacts, or share a join link. Anyone with the link can join in one tap — no account required to RSVP.

SPLIT IT FAIRLY
After the meal, snap a photo of the receipt and Owmo reads every line item automatically. Assign dishes to people, mark shared items to split evenly, and set the tip. Everyone sees exactly what they owe — no awkward math, no disputes.

SEE YOUR BALANCES
The Balances tab shows a clear picture of who owes what across all your recent events. Request money via Venmo, Cash App, or Zelle directly from the app. Mark payments as confirmed when everyone's settled up.

EVERYTHING IN ONE PLACE
Every event has its own space for planning details, live chat with your group, a shared photo gallery, and the final bill. No more bouncing between apps.

—

Owmo is free to download. A Premium subscription unlocks unlimited hosted events and early access to new features.`,
      },
    },
  });
  console.log('✓ Description + keywords + whats new updated');
}

// ── 6. Review information (notes + demo account) ──────────────────────────
const reviewRes = await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`);

const reviewNotes = `Test account for Apple review:
Email: reviewer@owmo.app
Password: OwmoReview2026!

Steps to test bill splitting:
1. Sign in with the test account above
2. Tap "+" to create a new event — name it "Test Dinner", pick any restaurant
3. Tap "Bill" tab → "Scan Receipt" — use the sample receipt image or type items manually
4. Assign items to participants, set tip, tap "Finalize"
5. The Balances tab will show what each person owes

The app requires an account to create events. Joining via invite link works without an account.

Premium features (unlimited events beyond 3) use RevenueCat / StoreKit sandbox — test with a sandbox Apple ID if reviewing IAPs.`;

if (reviewRes.data) {
  // Update existing review detail
  await asc('PATCH', `/v1/appStoreReviewDetails/${reviewRes.data.id}`, {
    data: {
      type: 'appStoreReviewDetails',
      id: reviewRes.data.id,
      attributes: {
        contactFirstName: 'Jeremy',
        contactLastName: 'Luabena',
        contactEmail: process.env.EXPO_APPLE_ID || 'jeremy@owmo.app',
        contactPhone: '+1 5550000000',
        demoAccountName: 'reviewer@owmo.app',
        demoAccountPassword: 'OwmoReview2026!',
        demoAccountRequired: true,
        notes: reviewNotes,
      },
    },
  });
} else {
  // Create new review detail
  await asc('POST', `/v1/appStoreReviewDetails`, {
    data: {
      type: 'appStoreReviewDetails',
      attributes: {
        contactFirstName: 'Jeremy',
        contactLastName: 'Luabena',
        contactEmail: process.env.EXPO_APPLE_ID || 'jeremy@owmo.app',
        contactPhone: '+1 5550000000',
        demoAccountName: 'reviewer@owmo.app',
        demoAccountPassword: 'OwmoReview2026!',
        demoAccountRequired: true,
        notes: reviewNotes,
      },
      relationships: {
        appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
      },
    },
  });
}
console.log('✓ Reviewer notes + demo account credentials set');

console.log('\n✅ All done. Remaining manual steps:');
console.log('  1. Create the demo account in-app: reviewer@owmo.app / OwmoReview2026!');
console.log('  2. Publish the deployment in Replit (click Publish)');
console.log('  3. Link the In-App Purchase in ASC → Pricing and Availability');
console.log('  4. Rotate the ASC API key in Apple Developer portal');
