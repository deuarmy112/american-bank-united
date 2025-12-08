# 🏦 American Bank United

A modern, full-stack banking application with secure authentication, account management, transactions, virtual cards, and bill payments.

## 🌟 Features

- ✅ User Authentication (JWT-based)
- ✅ Multiple Account Types (Checking, Savings, Credit Card)
- ✅ Money Transfers between accounts
- ✅ Transaction History & Filtering
- ✅ Virtual Card Management
- ✅ Bill Payment System
- ✅ Real-time Balance Updates
- ✅ Secure Password Hashing
- ✅ Rate Limiting & Security Headers

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- Responsive Design
- JWT Token Management

**Backend:**
- Node.js + Express.js
- PostgreSQL Database
- JWT Authentication
- bcrypt Password Hashing
- express-validator
- helmet (Security Headers)
- express-rate-limit

## 📁 Project Structure

```
american-bank-united/
├── server/                    # Backend API
│   ├── config/               # Database configuration
│   ├── middleware/           # Auth & validation
│   ├── routes/               # API endpoints
│   ├── scripts/              # Database initialization
│   ├── utils/                # Helper functions
│   ├── server.js             # Main entry point
│   └── package.json
├── js/                       # Frontend JavaScript
│   ├── api.js               # API client
│   ├── auth.js              # Authentication
│   └── [feature]-api.js     # Feature modules
├── css/                      # Stylesheets
├── images/                   # Assets
├── *.html                    # Pages
└── DEPLOYMENT.md             # Deployment guide
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd american-bank-united
   ```

2. **Set up the backend**
   ```bash
   cd server
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Initialize the database**
   ```bash
   npm run init-db
   ```

5. **Start the backend server**
   ```bash
   npm start
   # Server runs on http://localhost:5000
   ```

6. **Start the frontend** (in a new terminal)
   ```bash
   cd ..
   npm install -g http-server
   http-server -p 8080 -c-1
   # Frontend runs on http://localhost:8080
   ```

7. **Open your browser**
   ```
   http://localhost:8080
   ```

## 🔐 Environment Variables

Create a `.env` file in the `server` directory:

```env
PORT=5000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=american_bank_united
DB_PORT=5432

JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=24h

BCRYPT_ROUNDS=10

FRONTEND_URL=http://localhost:8080
```

### Generate Secure JWT Secret

```bash
cd server
npm run generate-secret
```

Or use the interactive config generator at `config-generator.html`

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (protected)

### Accounts
- `GET /api/accounts` - Get all accounts
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:id` - Get account details
- `GET /api/accounts/:id/transactions` - Get account transactions

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions/transfer` - Transfer money

### Cards
- `GET /api/cards` - Get all cards
- `POST /api/cards` - Request new card
- `PATCH /api/cards/:id/status` - Update card status

### Bills
- `GET /api/bills/billers` - Get all billers
- `POST /api/bills/billers` - Add new biller
- `GET /api/bills/payments` - Get payment history
- `POST /api/bills/payments` - Make payment

## 🌐 Production Deployment

See detailed deployment instructions in [DEPLOYMENT.md](DEPLOYMENT.md)

### Recommended Platforms

**Option 1: Render (Recommended)**
- Backend + Database: Render
- Frontend: Vercel or Netlify
- Free tier available

**Option 2: Railway**
- All-in-one deployment
- $5 free credit/month

**Option 3: Traditional**
- Backend: Heroku/AWS
- Database: AWS RDS/Heroku Postgres
- Frontend: Netlify/GitHub Pages

### Quick Deploy to Render

1. Create account at https://render.com
2. Create PostgreSQL database
3. Create Web Service (connect GitHub repo)
4. Set environment variables
5. Deploy!

Full guide in [DEPLOYMENT.md](DEPLOYMENT.md)

## 🔒 Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Rate limiting (100 requests/15 minutes)
- ✅ Security headers (helmet)
- ✅ CORS protection
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection
- ✅ Input validation

## 🧪 Testing

1. **Register a new account**
   - Navigate to `/register.html`
   - Fill in the form
   - Check for JWT token in localStorage

2. **Test features**
   - Create accounts
   - Transfer money between accounts
   - Request virtual cards
   - Add billers and make payments

3. **Check console**
   - Monitor network requests
   - Verify API responses
   - Check for errors

## 📈 Future Enhancements

- [ ] Email verification
- [ ] Two-factor authentication (2FA)
- [ ] Password reset flow
- [ ] Transaction notifications
- [ ] Scheduled payments
- [ ] Loan management
- [ ] Investment accounts
- [ ] Mobile app (React Native)
- [ ] Admin dashboard
- [ ] Analytics & reporting
- [ ] Dark mode
- [ ] Multi-language support

## 🐛 Troubleshooting

### CORS Errors
Update `FRONTEND_URL` in `.env` to match your frontend URL

### Database Connection Failed
- Check PostgreSQL is running
- Verify credentials in `.env`
- Ensure database exists

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Kill frontend server
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Module Not Found
```bash
cd server
npm install
```

## 📄 License

ISC

## 👥 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment help
- Review API documentation above
- Check console for error messages

---

Made with ❤️ for modern banking
