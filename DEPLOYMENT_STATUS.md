# Deployment Status

## Target architecture

- Frontend: Vercel static hosting
- API: Vercel serverless function at `/api`
- Database: Firebase Firestore
- File storage: Firebase Storage
- Authentication: Firestore users with signed JWTs

## Configuration checklist

- [ ] Firebase project created
- [ ] Firestore enabled
- [ ] Firebase Storage enabled
- [ ] Firebase service account created
- [ ] Vercel environment variables added
- [ ] Firestore rules and indexes deployed
- [ ] Storage rules deployed
- [ ] Vercel production deployment completed
- [ ] `/api/health` returns `provider: firebase`
- [ ] Registration and login tested
- [ ] Guest dashboard tested
- [ ] Account creation tested
- [ ] Transfer tested
- [ ] Card request tested
- [ ] Bill payment tested

See [FIREBASE_VERCEL_SETUP.md](FIREBASE_VERCEL_SETUP.md) for the exact commands and environment variables.

## Cost note

Vercel Hobby and Firebase Spark do not require a monthly subscription for basic use, but both are quota-based free tiers. They do not guarantee unlimited traffic or a production uptime SLA. Monitor quotas before using the application for real financial activity.
