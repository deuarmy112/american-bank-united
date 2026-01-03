# Admin System Setup Guide

## Database Migration

To add the admin system to your database, run the migration script:

### Local Development
```bash
cd server
node scripts/run-admin-migration.js
```

### Production (Render)
1. Go to your Render Dashboard
2. Select your PostgreSQL database
3. Click on "Shell" or "Query Editor"
4. Copy and paste the contents of `server/scripts/add-admin-system.sql`
5. Execute the SQL

Or use the Render Shell with:
```bash
psql $DATABASE_URL -f server/scripts/add-admin-system.sql
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
