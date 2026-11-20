const mysql = require("mysql2/promise");
const path = require("path");

const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true
});
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true
});

const requiredVariables = ["DB_HOST", "DB_USER", "DB_NAME"];

const missingVariables = requiredVariables.filter(
  (variable) => !process.env[variable]
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing database environment variables: ${missingVariables.join(", ")}`
  );
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: "Z"
});

async function testDatabaseConnection() {
  let connection;

  try {
    connection = await db.getConnection();
    await connection.ping();

    console.log("✅ FoodFlow database connected successfully!");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  db,
  testDatabaseConnection
};
