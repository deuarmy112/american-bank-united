# Firebase + Vercel setup

The frontend and API are now deployed from the same Vercel project. The API in `api/[...path].js` uses Firebase Admin to store application data in Firestore and creates signed Firebase Storage upload URLs.

## 1. Create Firebase resources

1. Create or select a Firebase project in the Firebase console.
2. Enable Firestore Database in production mode.
3. Enable Storage and create the default bucket.
4. Create a service account in Project settings > Service accounts.
5. Generate a private key JSON file. Keep it private and do not commit it.

The service account only runs in Vercel. Firestore and Storage rules are intentionally deny-by-default because all access goes through the serverless API.

## 2. Add Vercel environment variables

Add these variables to the Vercel project for Production, Preview, and Development where needed:

```text
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
JWT_SECRET=use-a-long-random-secret
NODE_ENV=production
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=American Bank United <transfers@americanbankunited.com>
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+15551234567
```

`FIREBASE_PRIVATE_KEY` must contain the literal `\n` sequences when entered in the Vercel dashboard. The API converts them to line breaks at runtime.

`RESEND_API_KEY` and `EMAIL_FROM` enable full transfer confirmation emails. The Twilio variables enable SMS notifications. Without these provider variables, transfers still complete and the API reports notifications as `not_configured`.

Automatic SMS alerts are sent for deposits, account transfers, external transfers, admin-funded credits, and transfers completed after approval. Store phone numbers in international E.164 format (for example, `+15551234567`) so Twilio can deliver them reliably. In Twilio trial mode, the destination number must also be verified in the Twilio console.

## 3. Deploy

From the repository root:

```bash
npm install
npx vercel login
npx vercel link
npx vercel env add FIREBASE_PROJECT_ID production
npx vercel env add FIREBASE_CLIENT_EMAIL production
npx vercel env add FIREBASE_PRIVATE_KEY production
npx vercel env add FIREBASE_STORAGE_BUCKET production
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
firebase deploy --only firestore:rules,firestore:indexes,storage
```

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
