# ⚡ FoodFlow - Quick Start Guide

Use the checks below to verify your local setup. Real bKash checkout requires
merchant sandbox credentials and a publicly reachable HTTPS callback URL.

---

## 🚀 Start in 5 Minutes

### Step 1: Setup Database (2 min)
```bash
# Make sure MySQL is running
# Windows:
net start MySQL80

# Then run schema
mysql -u root -p < database/schema.sql
```

For an existing database, apply each unapplied migration in numeric order.
Migration 008 fixes the meal deadline constraint and adds reservation QR tokens.

### Step 2: Configure Server (1 min)
```bash
# Edit server/.env file
# Change DB_PASSWORD to your MySQL password
```

### Step 3: Install & Run (2 min)
```bash
cd server
npm install
npm run dev
```

**Expected Output**:
```
✅ FoodFlow database connected successfully!
✅ FoodFlow server running at http://localhost:5000
```

---

## 🌐 Access Application

### Browser URLs
- **Login Page**: http://localhost:5500/login.html
- **API Health**: http://localhost:5000/api/health
- **API Docs**: Check `BUG_FIX_REPORT.md` for endpoints

### Test Account (after registration)
- Email: student@test.com
- Password: TestPass123
- Role: Student

---

## 📦 What Was Fixed

| Issue | Status | Details |
|-------|--------|---------|
| Missing QR token column | ✅ FIXED | Added to database schema |
| Meal deadline constraint blocked publishing | ✅ FIXED | Deadline is before the meal date; see migration 008 |
| QR missing after payment | ✅ FIXED | Payment result now loads and displays the reservation QR |
| Date rollover near midnight | ✅ FIXED | Meal dates and deadlines use Bangladesh time |
| Wrong status constant | ✅ FIXED | Changed "completed" to "collected" |
| Missing environment config | ✅ FIXED | .env and .env.example created |
| No QR styling | ✅ ENHANCED | 200+ lines of stylish CSS |
| No documentation | ✅ CREATED | README.md & BUG_FIX_REPORT.md |

---

## 📱 Features Now Working

✅ User Registration & Login
✅ Meal Browsing & Reservations
✅ **QR Code Generation** (with stylish design!)
✅ Reservation Management
✅ Staff Meal Collection
✅ Admin Dashboard
✅ Role-Based Access

---

## 🎨 Modern Design Highlights

### Stylish QR Code Cards
- Gradient backgrounds
- FoodFlow branding
- Smooth animations
- Responsive design
- Professional shadows

### Color Scheme
- Primary: `#294333` (Dark Green)
- Accent: `#d97718` (Warm Orange)
- Backgrounds: `#fffcf8` (Warm White)

---

## 🔍 Verify Everything

### Test Server Connection
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "ok",
  "service": "FoodFlow API",
  "database": "connected",
  "timestamp": "2026-09-02T..."
}
```

### Test Database
```bash
mysql -u root -p foodflow
SELECT * FROM users;
SHOW COLUMNS FROM reservations;  # Should show qr_token
```

---

## 📝 Environment Variables

### Required (.env)
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=foodflow
JWT_SECRET=any_long_string
PORT=5000
```

### Optional (with defaults)
```
NODE_ENV=development
BCRYPT_SALT_ROUNDS=12
JWT_EXPIRES_IN=7d
```

---

## ✅ Checklist Before Launch

- [ ] MySQL running
- [ ] Database imported: `source database/schema.sql`
- [ ] .env file created and configured
- [ ] `npm install` completed in server/
- [ ] Server starts: `npm run dev`
- [ ] API health check passes
- [ ] Can register new user
- [ ] Can login
- [ ] Dashboard loads
- [ ] QR code shows on reservation
- [ ] QR code looks stylish! 🎨

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| MySQL connection error | Check MySQL running: `net start MySQL80` |
| Port 5000 in use | Change PORT in .env |
| Database not found | Run `source database/schema.sql` |
| QR not showing | Apply migration 008, confirm payment completed, then refresh the result page |
| JWT error | Add JWT_SECRET to .env |
| Table already exists | Database was already imported, that's fine |

---

## 📚 Documentation

- **README.md** - Full project documentation
- **BUG_FIX_REPORT.md** - Detailed bug fixes and changes
- **.env.example** - Environment variables template

---

## 🎯 Next Steps

1. ✅ Start the server
2. ✅ Register a test account
3. ✅ Browse available meals
4. ✅ Make a reservation
5. ✅ View stylish QR code
6. ✅ Enjoy your meal management system!

---

## 📞 Common Commands

```bash
# Start server in development
cd server && npm run dev

# Stop server
Ctrl + C

# Restart database
mysql -u root -p < database/schema.sql

# Check Node version
node --version

# Check npm version
npm --version

# Clear Node cache
npm cache clean --force
```

---

**Everything is ready! Start your server and enjoy FoodFlow! 🍽️**

Questions? Check `README.md` or `BUG_FIX_REPORT.md`
