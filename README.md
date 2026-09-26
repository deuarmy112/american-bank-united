# American Bank United

A banking frontend with a Firebase-backed serverless API. Vercel serves the static pages and API functions, and Firestore stores application data. Firebase Storage is optional for signed file uploads.

## Features

- JWT registration, login, and profile APIs
- Guest dashboard mode that opens without the login page
- Firestore accounts and transaction history
- Atomic Firestore balance transfers
- Virtual cards and bill payments
- External transfer records
- Resend email, composed Firebase push alerts, and Firebase phone verification with email fallback
- Admin dashboard statistics and user listing
- Optional Firebase Storage signed upload URLs (requires an enabled bucket)

## Stack

- Vanilla HTML, CSS, and JavaScript
- Vercel static hosting and serverless functions
- Firebase Admin SDK
- Firestore
- Firebase Storage (optional)
- bcryptjs and JSON Web Tokens

## Local development

Requirements: Node.js 20+, a Firebase project, and npm.

```bash
npm install
npm start
```

Vercel serves the app at `http://localhost:3000`. Put Firebase server credentials in `.env.local`; the required variables are listed in [FIREBASE_VERCEL_SETUP.md](FIREBASE_VERCEL_SETUP.md).

## Deployment

Import the repository into Vercel, add the Firebase variables and a strong `JWT_SECRET`, then deploy. The frontend uses same-origin `/api` calls, so there is no Render service or CORS bridge to maintain.

See [DEPLOYMENT.md](DEPLOYMENT.md) and [FIREBASE_VERCEL_SETUP.md](FIREBASE_VERCEL_SETUP.md) for the full setup, Firebase rules, indexes, verification, and free-tier limitations.

## API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `GET /api/accounts`
- `POST /api/accounts`
- `GET /api/transactions`
- `POST /api/transactions/transfer`
- `GET`, `POST`, and `DELETE /api/push-subscriptions`
- `GET /api/cards`
- `POST /api/cards`
- `GET /api/bills/billers`
- `POST /api/bills/billers`
- `GET /api/bills/payments`
- `POST /api/bills/payments`
- `POST /api/storage/upload-url`

## Important

The free tiers are quota-based and do not provide an unlimited production uptime guarantee. Do not use guest mode or demo card values for real banking until the remaining business, security, audit, payment, and compliance requirements are implemented.
