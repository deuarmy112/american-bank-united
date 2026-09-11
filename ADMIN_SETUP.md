# Admin System Setup Guide

## Firestore Admin Setup

The active application uses Firebase Firestore through the Vercel API. The legacy
PostgreSQL migration files under `server/` are not used by the deployed app.

1. Pull the Vercel production variables into `.env.local`:
```bash
npx vercel env pull .env.local --environment=production
```
2. Download a Firebase service-account JSON file from Firebase Console > Project
Settings > Service accounts. Keep it outside the repository, then set its path:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\firebase-service-account.json"
```
Vercel redacts sensitive values during environment pulls, so `.env.local` alone
cannot be used for local Firestore seeding.
3. Seed or reset the admin user in Firestore:
```bash
npm run seed-admin
```

## Default Admin Credentials

After migration, you can log in to the admin portal with:

- **URL**: https://american-bank-united.vercel.app/admin-login.html
- **Email**: admin@americanbankunited.com
- **Password**: Admin@123

⚠️ **IMPORTANT**: Change the admin password after first login!

## Admin Portal Features

### 1. Dashboard
- Overview statistics (users, accounts, transactions, deposits)
- Quick action cards
- Recent admin activity log

### 2. User Management
- View all users with filters (status, search)
- View detailed user information
- Manage user status (active, inactive, suspended)
- View user accounts and transactions

### 3. Account Management
- Review pending account requests
- Approve or reject new accounts
- Adjust account balances (credit/debit)
- Full audit trail of all changes

### 4. Transaction Monitoring
- View all transactions across the system
- Filter by type, date range, and amount
- Monitor user activity
- Export capabilities (future feature)

### 5. Audit Log
- Complete log of all admin actions
- Track who did what and when
- Detailed metadata for each action
- Compliance and security tracking

## Admin Capabilities

- ✅ Approve/Reject new account creation
- ✅ Activate/Deactivate/Suspend user accounts
- ✅ Add or subtract from user account balances
- ✅ View all transactions system-wide
- ✅ Monitor user activity
- ✅ Full audit trail of admin actions
- ✅ View detailed user information
- ✅ System-wide statistics and reports

## Security Features

- Role-based access control (admin, super_admin)
- JWT authentication required for all admin endpoints
- All admin actions are logged
- Password hashing with bcrypt
- Status checking on user login
- Rate limiting on API endpoints

## New Database Tables

### `admin_actions`
Logs all admin activities for audit purposes

### `balance_adjustments`
Records manual balance changes by admins

### `transaction_reviews`
For flagging and reviewing suspicious transactions (future use)

### User Table Updates
- Added `role` column (customer, admin, super_admin)
- Added `status` column (active, inactive, suspended)
- Added `last_login` column

### Account Table Updates
- Added `approval_status` column (pending, approved, rejected)
- Added `approved_by` and `approved_at` columns

## API Endpoints

All admin endpoints require authentication and admin role:

- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - User details
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/accounts/pending` - Pending account approvals
- `POST /api/admin/accounts/:id/approve` - Approve account
- `POST /api/admin/accounts/:id/reject` - Reject account
- `POST /api/admin/accounts/:id/adjust-balance` - Adjust balance
- `GET /api/admin/transactions` - All transactions with filters
- `GET /api/admin/audit-log` - Admin action audit log

## Testing the Admin Portal

1. Deploy the migration to production database
2. Access admin login: https://american-bank-united.vercel.app/admin-login.html
3. Login with default credentials
4. Test each feature:
   - View dashboard statistics
   - Search and filter users
   - Review pending accounts
   - Approve an account
   - Adjust a balance
   - View transactions
   - Check audit log

## Notes

- All new accounts now require admin approval before activation
- Admins can manually adjust balances with a required reason
- Every admin action is logged for compliance
- Regular users cannot access admin endpoints
- Admin portal is separate from customer portal

## Future Enhancements

- [ ] Email notifications for account approvals/rejections
- [ ] Transaction reversal capability
- [ ] Bulk operations (approve multiple accounts)
- [ ] Advanced reporting and analytics
- [ ] Export data to CSV/PDF
- [ ] Two-factor authentication for admin accounts
- [ ] Role-based permissions (view-only admin, etc.)
