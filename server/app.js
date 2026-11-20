const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { rateLimit } = require("express-rate-limit");
const dotenv = require("dotenv");

// Prefer the documented project-level .env, while retaining support for
// existing installations that keep their settings in server/.env.
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true
});
dotenv.config({
  path: path.resolve(__dirname, ".env"),
  quiet: true
});

const { db, testDatabaseConnection } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const mealRoutes = require("./routes/mealRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim());

app.disable("x-powered-by");
app.set("trust proxy", 1);

// Security and request middleware
app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    // Browser direct visit, Postman, or allowed frontend
    const isLocalFileOrigin = NODE_ENV !== "production" && origin === "null";

    if (!origin || isLocalFileOrigin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error("CORS policy does not allow this origin");
    error.statusCode = 403;
    return callback(error);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: "10kb" }));
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

// Protect API from excessive requests
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
}));

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FoodFlow API is running"
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.status(200).json({
      success: true,
      status: "ok",
      service: "FoodFlow API",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unavailable",
      database: "disconnected"
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/payments", paymentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error(error);

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500
      ? "Internal server error"
      : error.message,
    ...(NODE_ENV === "development" && { stack: error.stack })
  });
});

let server;

async function startServer() {
  try {
    await testDatabaseConnection();

    server = app.listen(PORT, () => {
      console.log(`✅ FoodFlow server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n${signal} received. Closing server...`);

  if (server) {
    server.close(async () => {
      await db.end();
      console.log("Database pool closed. Server stopped.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, shutdown };
