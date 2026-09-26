# Firebase + Vercel setup

The frontend and API are deployed from the same Vercel project. The API in `api/[...path].js` uses Firebase Admin to store application data in Firestore. Firebase Storage is optional and is only needed for the signed upload URL endpoint; the current frontend does not call it.

## 1. Create Firebase resources

1. Create or select a Firebase project in the Firebase console.
2. Enable Firestore Database in production mode.
3. Enable Storage and create the default bucket only if you need file uploads. You can skip this for the current app setup.
4. Create a service account in Project settings > Service accounts.
5. Generate a private key JSON file. Keep it private and do not commit it.

The service account only runs in Vercel. Firestore and Storage rules are intentionally deny-by-default because all access goes through the serverless API.

## 2. Add Vercel environment variables

Add these variables to the Vercel project for Production, Preview, and Development where needed:

```text
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
JWT_SECRET=use-a-long-random-secret
NODE_ENV=production
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=American Bank United <transfers@americanbankunited.com>
```

`FIREBASE_PRIVATE_KEY` must contain the literal `\n` sequences when entered in the Vercel dashboard. The API converts them to line breaks at runtime.

`RESEND_API_KEY` and `EMAIL_FROM` enable transfer confirmation and fallback verification emails. Firebase Cloud Messaging delivers composed browser push alerts to both transaction parties. Firebase Authentication sends phone verification codes; real phone-auth SMS requires the Blaze pay-as-you-go plan. The app keeps its JWT login and validates Firebase phone-auth tokens server-side before marking a phone verified. If SMS is unavailable, a one-use Resend email code can verify the account, but the phone remains unverified.

## 2a. Configure Firebase browser push

1. In Firebase project settings, add a Web App and enable Firebase Cloud Messaging for the project.
2. In **Project settings > Cloud Messaging > Web Push certificates**, generate a key pair.
3. Copy the Web App's public configuration values into `js/firebase-web-config.js`. Replace each `REPLACE_WITH_...` value, including `projectId` and `messagingSenderId`.
4. Set `ABU_FIREBASE_VAPID_KEY` in that same file to the public Web Push certificate key from step 2.
5. In **Authentication > Sign-in method**, enable **Phone**. In **Authentication > Settings**, allow the SMS regions you support and add your Vercel/custom domains as authorized domains. Firebase's SDK handles reCAPTCHA during the phone verification flow.
6. Deploy the site over HTTPS. Signed-in users can enable or disable browser push in Settings; the browser will ask for notification permission. Registration and phone changes offer Firebase SMS verification or Resend email fallback.

The Firebase Web App configuration and VAPID key are public client values. Never put the Firebase service-account private key in this file; it must remain in Vercel environment variables. Push tokens are stored in the server-only `push_tokens` Firestore collection, and the service worker displays generic alerts without amounts or account numbers. Firebase Cloud Messaging has no per-message charge; delivery depends on browser support and permission.

Browser push alerts are available for deposits, account transfers, external transfers, admin-funded credits, and transfers completed after approval when a signed-in user has enabled push in Settings. Credit/debit push alerts include the amount and transaction type, but not account numbers. Email alerts continue to use Resend. Firebase phone verification requires Blaze billing for real SMS, the Phone provider, an allowed SMS region policy, an authorized web domain, and working Web App configuration.

### Show the bank logo beside the sender in Gmail

The logo inside the email HTML does not control Gmail's sender avatar. Gmail uses sender-domain branding, so configure this in DNS after verifying `americanbankunited.com` with Resend:

1. Publish a DMARC TXT record for `_dmarc.americanbankunited.com` with an enforcement policy, such as `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@americanbankunited.com`.
2. Host an approved BIMI SVG logo at an HTTPS URL.
3. Publish a TXT record for `default._bimi.americanbankunited.com`:

```text
v=BIMI1; l=https://americanbankunited.com/assets/abu-logo.svg; a=https://your-certificate-host.example/americanbankunited.pem
```

Gmail generally requires a verified mark certificate (`a=`) for BIMI logo display. The certificate and SVG must meet the BIMI specification. After DNS propagation, Gmail may take time to refresh its cached sender icon. Do not put the logo in `EMAIL_FROM`; keep that value as `American Bank United <transfers@americanbankunited.com>`.

## 3. Deploy

From the repository root:

```bash
npm install
npx vercel login
npx vercel link
npx vercel env add FIREBASE_PROJECT_ID production
npx vercel env add FIREBASE_CLIENT_EMAIL production
npx vercel env add FIREBASE_PRIVATE_KEY production
npx vercel env add JWT_SECRET production
npx vercel --prod
```

The frontend calls `/api`, so no Render URL or CORS configuration is needed for the deployed site.

## 4. Create the Firestore admin user

Admin credentials are stored as a bcrypt hash in the Firestore `users` collection.
Vercel replaces sensitive values with `[SENSITIVE]` during environment pulls,
so use a downloaded Firebase service-account JSON file for local seeding:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\firebase-service-account.json"
```

Keep this file outside the repository. Then run:

```bash
npx vercel env pull .env.local --environment=production
npm run seed-admin
```

The command creates or updates `admin@americanbankunited.com` with the password
from `ADMIN_PASSWORD`. Always set a strong password explicitly before running
the command; do not rely on a default password.

## 5. Firebase CLI rules and indexes

Install the Firebase CLI if needed, select the project, and deploy the rules/indexes:

```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,firestore:indexes
```

Do not add the `storage` target unless you have enabled Firebase Storage and created a bucket. Without Storage, the rest of the app can use Firestore normally, but the `/api/storage/upload-url` endpoint will not be available.

## 6. Verify

After deployment, check:

```text
https://americanbankunited.com/api/health
```

The response should include `"status":"OK"` and `"provider":"firebase"`.

Opening the site creates a guest demo token so the dashboard can be viewed without the login page. Real registration and login still use the Firestore `users` collection and signed JWTs.

## Cost and uptime note

Vercel Hobby and Firebase Spark are generally usable without a monthly subscription, but neither is an unlimited production SLA. They are quota-based free tiers with limits on function execution, reads/writes, storage, bandwidth, and build usage. Firebase and Vercel can pause, throttle, or require an upgrade if quotas are exceeded. A custom domain, payment provider, email delivery, and higher traffic may also create separate costs.

For a real banking product, do not use the guest mode or the generated demo card values in production. Enable Firebase App Check, add stronger admin controls, use a secrets manager, and review the Firestore data model and audit requirements before accepting real money.
