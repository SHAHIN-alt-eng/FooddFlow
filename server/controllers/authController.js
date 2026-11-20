const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db } = require("../config/db");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Only RUET email addresses are allowed to register or sign in.
// Matches "...@ruet.ac.bd" as well as subdomains like
// "...@student.ruet.ac.bd" or "...@mail.ruet.ac.bd".
const RUET_EMAIL_PATTERN = /^[^\s@]+@([a-z0-9-]+\.)*ruet\.ac\.bd$/i;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
const VALID_GENDERS = ["male", "female"];

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );
}

async function registerUser(req, res, next) {
  try {
    const { name, email, password, gender } = req.body;
    const role = "student";

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string"
      ? email.trim().toLowerCase()
      : "";

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required."
      });
    }

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    if (!RUET_EMAIL_PATTERN.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Only RUET email addresses (@ruet.ac.bd) can be used to register."
      });
    }

    if (!VALID_GENDERS.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Gender must be male or female for student accounts."
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 8-72 characters with uppercase, lowercase and a number."
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query(
      `INSERT INTO users (name, email, password_hash, role, gender, hall_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cleanName, cleanEmail, passwordHash, role, gender, null]
    );

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user: {
        id: result.insertId,
        name: cleanName,
        email: cleanEmail,
        role,
        gender,
        hall_name: null
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email is already registered."
      });
    }

    return next(error);
  }
}

async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;

    const cleanEmail = typeof email === "string"
      ? email.trim().toLowerCase()
      : "";

    if (!cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const [users] = await db.query(
      `SELECT id, name, email, password_hash, role, gender, hall_name, status
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [cleanEmail]
    );

    const user = users[0];

    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Student accounts must always sign in with their RUET email.
    // (Staff/admin accounts are created separately by an admin and
    // are not required to use a @ruet.ac.bd address.)
    if (user.role === "student" && !RUET_EMAIL_PATTERN.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please sign in using a valid RUET email address (@ruet.ac.bd)."
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    await db.query(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        hall_name: user.hall_name
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const userId = req.user.sub;

    const [users] = await db.query(
      `SELECT
        id,
        name,
        email,
        role,
        gender,
        hall_name,
        status,
        phone,
        profile_image,
        email_verified_at,
        last_login_at,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
      LIMIT 1`,
      [userId]
    );

    const user = users[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser
};
