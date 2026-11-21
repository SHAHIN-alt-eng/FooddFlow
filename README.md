# 🍽️ FoodFlow - Smart Hall Meal Management System

A comprehensive web application for managing meal reservations in university halls or residential facilities.

## 📋 Features

✅ **User Authentication**
- Secure login/registration with JWT tokens
- Role-based access control (Student, Staff, Admin)
- Password hashing with bcrypt
- Email validation

✅ **Meal Management**
- Browse available meals by type and date
- Detailed meal information with capacity tracking
- Real-time meal availability updates

✅ **Reservation System**
- Reserve meals with one-click booking
- Unique QR code generation for each reservation
- Cancel reservations before deadline
- Track reservation history

✅ **QR Code Integration**
- Stylish QR code cards with FoodFlow branding
- One-time token-based QR codes for meal collection
- Mobile-friendly QR display

✅ **Dashboard Features**
- Student: View reservations, browse meals, manage profile
- Staff: Create/manage meals, verify meal collection
- Admin: Full system management, user management, statistics

✅ **Modern Design**
- Responsive UI for desktop and mobile
- Smooth animations and transitions
- Intuitive navigation
- Beautiful gradient backgrounds

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ and npm
- MySQL 5.7+
- Modern web browser

### Installation

#### 1. **Clone/Download Project**
```bash
cd FooddFlow
```

#### 2. **Setup Database**
```bash
# Start MySQL service (Windows)
net start MySQL80

# Login to MySQL
mysql -u root -p

# Run the schema
source database/schema.sql

# Exit MySQL
exit
```

For an existing database, apply unapplied SQL files in `database/migrations/`
in numeric order. Do not re-run migrations that have already been applied.
Migration `008_meal_deadline_and_qr_token.sql` corrects the meal cutoff rule and
adds the reservation QR-token column required by current payment flows.

#### 3. **Configure Environment**
```bash
# Copy example file
copy .env.example .env

# Edit .env with your settings
# Update DB_PASSWORD with your MySQL password
```

.env file must contain:
```
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173,http://localhost:5500

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=foodflow

JWT_SECRET=your_secret_key_here
```

Client pages use `http://localhost:5000/api` for local development. For a
separate production API, set
`<meta name="foodflow-api-base-url" content="https://api.example.com/api">`
in each client HTML page and include that site's origin in `CLIENT_URL`.

#### 4. **Install Server Dependencies**
```bash
cd server
npm install
```

#### 5. **Start Server**
```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

Output should show:
```
✅ FoodFlow database connected successfully!
✅ FoodFlow server running at http://localhost:5000
```

#### 6. **Access Client**

Open in browser:
- **Login**: http://localhost:5500/login.html
- **API Health Check**: http://localhost:5000/api/health

### Default Test Credentials

After database setup, you can create test users:

```sql
-- Student Account
INSERT INTO users (name, email, password_hash, role, status)
VALUES ('Test Student', 'student@test.com', '$2b$12$...', 'student', 'active');

-- Use password generation from the app
```

Or register through the UI:
- Email: student@test.com
- Password: TestPass123
- Role: Student

## 📁 Project Structure

```
FooddFlow/
├── client/                 # Frontend (HTML/CSS/JS)
│   ├── login.html
│   ├── register.html
│   ├── student-dashboard.html
│   ├── staff-dashboard.html
│   ├── admin-dashboard.html
│   ├── css/
│   │   └── style.css       # All styling (modern QR codes!)
│   └── js/
│       ├── login.js
│       ├── register.js
│       └── *-dashboard.js
│
├── server/                 # Backend (Node.js/Express)
│   ├── app.js              # Main server
│   ├── package.json
│   ├── config/
│   │   └── db.js           # Database connection
│   ├── middlewares/
│   │   └── authMiddleware.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── mealController.js
│   │   ├── reservationController.js
│   │   └── adminController.js
│   └── routes/
│       ├── authRoutes.js
│       ├── mealRoutes.js
│       ├── reservationRoutes.js
│       └── adminRoutes.js
│
└── database/
    └── schema.sql          # MySQL schema with QR token support
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile

### Meals
- `GET /api/meals` - Get available meals
- `GET /api/meals/today` - Get today's meals
- `GET /api/meals/:id` - Get meal details
- `POST /api/meals` - Create meal (Staff/Admin)
- `PUT /api/meals/:id` - Update meal (Staff/Admin)
- `DELETE /api/meals/:id` - Cancel meal (Staff/Admin)

### Reservations
- `GET /api/reservations` - Get my reservations
- `POST /api/reservations` - Reserve a meal
- `GET /api/reservations/:id` - Get reservation details
- `DELETE /api/reservations/:id` - Cancel reservation
- `POST /api/reservations/collect` - Collect meal (Staff/Admin)

### Payments
- `POST /api/payments/bkash/create` - Start a bKash checkout
- `POST /api/payments/bkash/execute/:paymentId` - Verify the student's payment
- `GET /api/payments/bkash/callback` - bKash callback endpoint
- `GET /api/payments/received` - View payments for staff-published meals

The local demo flow does not charge money. Production bKash refunds are not
automatic: cancellation records a pending refund for merchant processing.

### Admin
- `GET /api/admin/overview` - Dashboard overview
- `GET /api/admin/users` - Get all users
- `GET /api/admin/reservations` - Get all reservations

## 🎨 Design Highlights

### Modern QR Code Cards
- Stylish gradient backgrounds
- FoodFlow branding in center
- Smooth animations on load
- Responsive on all devices
- Beautiful shadows and borders

### Color Scheme
- Primary Green: `#16a34a`
- Accent Orange: `#d97718`
- Dark Slate: `#294333`
- Clean Whites & Grays

### Animations
- Card slide-in effects
- Hover state transitions
- Loading skeletons
- Smooth button interactions

## 🔒 Security Features

✅ JWT Token-based authentication
✅ Bcrypt password hashing (12 rounds)
✅ CORS protection
✅ Rate limiting on endpoints
✅ Helmet.js security headers
✅ SQL injection protection (parameterized queries)
✅ Input validation on all forms
✅ Role-based access control
✅ Database transactions for consistency

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solution**: Ensure MySQL is running
```bash
# Windows
net start MySQL80

# Mac
brew services start mysql

# Linux
sudo systemctl start mysql
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution**: Change PORT in .env or kill process on port 5000

### QR Code Not Showing
- Apply unapplied database migrations, especially migration 008
- Confirm the payment completed and the reservation has a `qr_token`
- Ensure the QRCode library is loaded
- Check browser console for errors
- The QR token is shown on the payment success page and in the student dashboard

### JWT Secret Error
```
Error: JWT_SECRET is missing from environment variables
```
**Solution**: Add JWT_SECRET to .env file

## 📊 Database Schema

### Users Table
- ID, Name, Email, Role, Status
- Password hash with salt rounds
- Email verification tracking
- Last login timestamp

### Meals Table
- ID, Date, Type (breakfast/lunch/dinner)
- Menu name, Description, Capacity
- Reserved count, Deadline
- Status (available/closed/cancelled)

### Reservations Table
- ID, User ID, Meal ID
- Status (reserved/cancelled/collected)
- **QR Token** (UUID - unique per reservation)
- Reserved/Cancelled/Collected timestamps

## 🔄 Reservation Flow

1. Student browses available meals
2. Clicks "Reserve Meal"
3. Reservation created with unique QR token
4. QR code displayed in dashboard
5. Student shows QR at meal collection
6. Staff scans to mark as collected

## 📱 Responsive Design

- ✅ Desktop (1200px+)
- ✅ Tablet (760px - 1200px)
- ✅ Mobile (< 760px)
- ✅ Small Mobile (< 480px)

## 🎓 Technologies Used

**Frontend**
- HTML5, CSS3 (with modern features)
- Vanilla JavaScript (no framework)
- QRCode.js library
- Fetch API for backend communication

**Backend**
- Node.js & Express.js
- MySQL2/Promise
- JWT authentication
- Bcrypt password hashing
- Helmet security middleware
- Express Rate Limiting
- CORS middleware

**Database**
- MySQL 5.7+
- InnoDB engine
- Foreign key constraints
- Indexed queries

## 📝 License

This project is part of ECE 2.1 Software Development Project.

## 👨‍💻 Support

For issues or questions:
1. Check troubleshooting section
2. Review server logs
3. Check browser console
4. Verify .env configuration
5. Ensure database is running

---

**Built with ❤️ for efficient meal management**

Last Updated: September 2, 2026
