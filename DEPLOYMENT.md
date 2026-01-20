# 🚀 Deployment Guide - American Bank United

## 📋 Platform Recommendations

### **Best Choice: Render (All-in-One)**
✅ **Backend + Database** on Render (Free tier available)
- Includes PostgreSQL database
- Automatic HTTPS
- Easy environment variables
- Zero-downtime deploys

✅ **Frontend** on Vercel or Netlify
- Both have generous free tiers
- Automatic deployments from Git
- Global CDN
- Custom domains

---

## 🎯 Option 1: Render (Recommended)

### Backend + Database Deployment on Render

1. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Name: `american-bank-db`
   - Free tier selected
   - Click "Create Database"
   - **Save the Internal Database URL** (starts with `postgresql://`)

3. **Deploy Backend**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Settings:
     - **Name**: `american-bank-api`
     - **Environment**: `Node`
     - **Region**: Choose closest to you
     - **Branch**: `main`
     - **Root Directory**: `server`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free

4. **Add Environment Variables**
   ```
   NODE_ENV=production
   JWT_SECRET=[Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"]
   JWT_EXPIRES_IN=24h
   BCRYPT_ROUNDS=10
   DATABASE_URL=[Paste your Render PostgreSQL Internal Database URL]
   FRONTEND_URL=https://your-app.vercel.app
   ```

5. **Update Database Config** (if using DATABASE_URL)
   Edit `server/config/database.js` to support DATABASE_URL:
   ```javascript
   const config = process.env.DATABASE_URL ? {
       connectionString: process.env.DATABASE_URL,
       ssl: { rejectUnauthorized: false }
   } : {
       host: process.env.DB_HOST,
       user: process.env.DB_USER,
       password: process.env.DB_PASSWORD,
       database: process.env.DB_NAME,
       port: process.env.DB_PORT
   };
   ```

6. **Initialize Database**
   - After first deploy, use Render Shell:
   - Click on your service → "Shell" tab
   - Run: `npm run init-db`

7. **Get Your Backend URL**
   - Copy your Render service URL (e.g., `https://american-bank-api.onrender.com`)

---

### Frontend Deployment on Vercel

1. **Update API URL**
   - Edit `js/api.js`
   - Replace `your-backend-url.onrender.com` with your actual Render URL

2. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign up with GitHub

3. **Deploy Frontend**
   - Click "New Project"
   - Import your repository
   - Settings:
     - **Framework Preset**: Other
     - **Root Directory**: `./` (root)
     - **Build Command**: Leave empty (static site)
     - **Output Directory**: `./` (root)
   - Click "Deploy"

4. **Update CORS**
   - Copy your Vercel URL (e.g., `https://your-app.vercel.app`)
   - Go to Render → Your service → Environment
   - Update `FRONTEND_URL` with your Vercel URL

5. **Test Your App**
   - Visit your Vercel URL
   - Register a new account
   - Test all features

---

## 🎯 Option 2: Railway (Alternative)

### Backend + Database on Railway

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

4. **Configure Service**
   - Click on your service
   - Settings:
     - **Root Directory**: `server`
     - **Start Command**: `npm start`
   
5. **Add Environment Variables**
   ```
   NODE_ENV=production
   JWT_SECRET=[Generate strong secret]
   JWT_EXPIRES_IN=24h
   BCRYPT_ROUNDS=10
   FRONTEND_URL=https://your-app.vercel.app
   ```

6. **Generate Domain**
   - Settings → Generate Domain
   - Copy the URL

7. **Initialize Database**
   - Use Railway's terminal or run locally:
   ```bash
   DATABASE_URL=[your-railway-db-url] npm run init-db
   ```

---

## 🎯 Option 3: Traditional Hosting

### Backend on Heroku / Database on Heroku Postgres

**Note**: Heroku removed free tier, now starts at $5/month

1. **Install Heroku CLI**
   ```powershell
   npm install -g heroku
   ```

2. **Login and Create App**
   ```bash
   heroku login
   cd server
   heroku create american-bank-api
   ```

3. **Add PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=[your-secret]
   heroku config:set FRONTEND_URL=https://your-app.netlify.app
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

6. **Initialize Database**
   ```bash
   heroku run npm run init-db
   ```

### Frontend on Netlify

1. **Create `netlify.toml`** (in root)
   ```toml
   [build]
     publish = "."
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. **Deploy**
   - Go to https://netlify.com
   - Drag and drop your project folder
   - Or connect GitHub for auto-deploys

---

## 🔒 Security Checklist

Before deploying:

- [ ] Generate strong JWT_SECRET (64+ characters)
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS (automatic on Render/Vercel)
- [ ] Update CORS with specific frontend URLs
- [ ] Never commit .env files
- [ ] Use environment variables for all secrets
- [ ] Enable rate limiting (already configured)
- [ ] Review helmet security headers (already configured)

---

## 🧪 Testing Production

1. **Test Health Endpoint**
   ```bash
   curl https://your-api.onrender.com/api/health
   ```

2. **Test Registration**
   - Open your frontend URL
   - Create a new account
   - Verify JWT token is stored

3. **Test All Features**
   - Login/Logout
   - Create accounts
   - Transfer money
   - Request cards
   - Add billers
   - Pay bills

---

## 📊 Monitoring

### Render Dashboard
- View logs: Service → Logs
- Monitor metrics: Service → Metrics
- Database stats: Database → Metrics

### Error Tracking (Optional)
Consider adding Sentry for error tracking:
```bash
npm install @sentry/node
```

---

## 💰 Cost Comparison

| Platform | Free Tier | Paid Tier |
|----------|-----------|-----------|
| **Render** | 750 hrs/month (backend), 1GB PostgreSQL | $7/month (1GB RAM), $7/month (DB) |
| **Railway** | $5 free credit/month | $5/month + usage |
| **Vercel/Netlify** | 100GB bandwidth | $20/month (pro) |
| **Heroku** | None (discontinued) | $5/month (basic) |

**Best Free Option**: Render (backend+DB) + Vercel (frontend)

---

## 🚨 Common Issues

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly
- Check browser console for exact origin
- Add all frontend domains (www and non-www)

### Database Connection
- Render: Use Internal Database URL
- Check SSL settings for production databases
- Verify DATABASE_URL format

### Build Failures
- Check Node.js version (use 18.x or 20.x)
- Verify package.json scripts
- Review build logs in platform dashboard

### Monorepo / Subfolder Deploys (ENOENT: package.json not found)

If your repository places the app inside a subfolder (for example `american-bank-united` or `server`), platform builders (Render, Vercel) may run `npm` at the repository root and fail with an error like:

```
npm ERR! enoent ENOENT: no such file or directory, open '/opt/render/project/src/package.json'
```

Fixes (pick one):

1) Set the platform's "Root Directory" to the subfolder that contains `package.json` (recommended). Example for Render: set **Root Directory** to `server` (for the API) or `american-bank-united` if the frontend lives there.

2) Change the build command to run in the subfolder. Example Render build command:

```bash
cd american-bank-united && npm install && npm run migrate && npm run build
```

3) Add a minimal `package.json` at the repository root that proxies scripts into the subfolder (optional). This lets platforms run `npm install` at root but delegate to the subproject. Example `package.json` to commit to repo root:

```json
{
   "name": "root-proxy",
   "private": true,
   "scripts": {
      "preinstall": "cd american-bank-united && npm install",
      "migrate": "cd american-bank-united && npm run migrate",
      "build": "cd american-bank-united && npm run build",
      "start": "cd american-bank-united && npm start"
   }
}
```

Local test commands to reproduce and validate the fix:

```bash
git clone <your-repo.git>
cd <repo>
# inspect where package.json lives
ls -la
ls -la american-bank-united

# run build from the correct folder
cd american-bank-united
npm install
npm run migrate
npm run build
```

If you see `ENOENT` in platform logs, make sure the directory you configured on the platform actually contains `package.json`.

---

## 🔄 CI/CD Setup

Both Render and Vercel auto-deploy on Git push:

1. Push to GitHub
2. Automatic deploy triggered
3. Monitor progress in platform dashboard
4. Automatic rollback on failure

---

## 📝 Post-Deployment Tasks

- [ ] Set up custom domain
- [ ] Configure SSL certificate (automatic)
- [ ] Set up monitoring alerts
- [ ] Create backup strategy
- [ ] Document API endpoints
- [ ] Add status page (status.io)
- [ ] Set up analytics (Google Analytics)

---

## 🆘 Support

- **Render**: https://render.com/docs
- **Vercel**: https://vercel.com/docs
- **Railway**: https://docs.railway.app
- **Netlify**: https://docs.netlify.com
