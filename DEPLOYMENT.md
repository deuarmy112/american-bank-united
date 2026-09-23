# Deployment Guide

American Bank United uses Vercel for the static frontend and serverless API, with Firebase Firestore for application data and Firebase Storage for uploaded files.

## Deploy

1. Create a Firebase project.
2. Enable Firestore and Storage.
3. Create a Firebase service account and generate a private key.
4. Import this repository into Vercel.
5. Add the Firebase variables and `JWT_SECRET` described in [FIREBASE_VERCEL_SETUP.md](FIREBASE_VERCEL_SETUP.md).
6. Deploy with Vercel.
7. Add `americanbankunited.com` to the Vercel project under Settings > Domains.
8. Deploy the Firestore and Storage rules/indexes with the Firebase CLI.

The frontend calls the API through `/api`, so the deployed application does not depend on Render, a long-running Express process, or a separate CORS origin.

## Local development

```bash
npm install
npm start
```

Vercel CLI serves the site at `http://localhost:3000`. Put Firebase variables in `.env.local` when testing authenticated Firestore operations locally.

## Verification

Open this endpoint after deployment:

```text
https://americanbankunited.com/api/health
```

The response should contain `"status":"OK"` and `"provider":"firebase"`.

## Free-tier expectations

Vercel Hobby and Firebase Spark can be used without a monthly subscription, subject to their current quotas and policies. They are not an unlimited uptime SLA. Function invocations, Firestore reads/writes, storage, bandwidth, builds, and custom services can be limited or billed when quotas or plan rules change. Review the current provider pricing before using the app for real financial activity.
