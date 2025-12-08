# American Bank United - Backend Server

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v5.7 or higher)

### Installation Steps

1. **Navigate to server directory:**
```powershell
cd server
```

2. **Install dependencies:**
```powershell
npm install
```

3. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Update database credentials and JWT secret

```powershell
Copy-Item .env.example .env
```

Edit `.env` file:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=american_bank_united
JWT_SECRET=your_random_secret_key_here
```

4. **Initialize database:**
```powershell
npm run init-db
```

5. **Start the server:**
```powershell
npm start
```

For development with auto-reload:
```powershell
npm run dev
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (requires token)

### Accounts
- `GET /api/accounts` - Get all user accounts
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:id` - Get specific account
- `GET /api/accounts/:id/transactions` - Get account transactions

### Transactions
- `GET /api/transactions` - Get all user transactions
- `POST /api/transactions/transfer` - Transfer money between accounts

### Cards
- `GET /api/cards` - Get all user cards
- `POST /api/cards` - Request new card
- `PATCH /api/cards/:id/status` - Block/unblock card

### Bills
- `GET /api/bills/billers` - Get saved billers
- `POST /api/bills/billers` - Add new biller
- `GET /api/bills/payments` - Get payment history
- `POST /api/bills/payments` - Pay bill

## 🔐 Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## 📝 Example Requests

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

## 🛠️ Technology Stack

- **Express.js** - Web framework
- **MySQL2** - Database driver
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting

## 📂 Project Structure

```
server/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   ├── auth.js              # JWT authentication middleware
│   └── validation.js        # Request validation
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── accounts.js          # Account management routes
│   ├── transactions.js      # Transaction routes
│   ├── cards.js             # Card management routes
│   └── bills.js             # Bill payment routes
├── scripts/
│   └── init-database.js     # Database initialization script
├── utils/
│   └── helpers.js           # Helper functions
├── .env.example             # Environment variables template
├── package.json             # Dependencies
└── server.js                # Main server file
```

## 🔧 Troubleshooting

**Database connection error:**
- Ensure MySQL is running
- Verify credentials in `.env` file
- Check if database exists (run `npm run init-db`)

**Port already in use:**
- Change PORT in `.env` file
- Kill process using port 5000: `Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process`

## 🚦 Next Steps

After server is running:
1. Update frontend to use API endpoints
2. Replace localStorage calls with fetch/axios
3. Implement token storage and management
4. Test all features with real database
