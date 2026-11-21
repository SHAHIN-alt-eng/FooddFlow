"use strict";

const bcrypt = require("bcrypt");
const { db } = require("../config/db");
const { BANGLADESH_TOMORROW_SQL } = require("../utils/bangladeshTime");

const USER_ROLES = ["student", "staff", "admin"];
const USER_STATUSES = ["active", "inactive", "suspended"];
const DELETABLE_ROLES = ["student", "staff"];
const RESERVATION_STATUSES = [
  "pending_payment",
  "reserved",
  "cancelled",
  "collected",
  "completed"
];
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_HALLS = [
  "Shaheed President Zia Hall",
  "Abdul Hamid Hall",
  "Tinshed Hall",
  "Shohidul Hall",
  "Shere-e-Bangla A K Fazlul Haque Hall",
  "Selim Hall",
  "Male Hall-1",
  "Male Hall-2",
  "Male Hall-3",
  "Female Hall 1",
  "Female Hall 2"
];

function cleanQueryValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getOverview(req, res, next) {
  try {
    const [[users]] = await db.query(`
      SELECT
        COUNT(*) AS total_users,
        SUM(role = 'student') AS students,
        SUM(role = 'staff') AS staff,
        SUM(role = 'admin') AS admins
      FROM users
    `);
    const [[meals]] = await db.query(`
      SELECT
        COUNT(*) AS published_meals,
        COALESCE(SUM(GREATEST(capacity - reserved_count, 0)), 0) AS meal_remaining
      FROM meals
      WHERE meal_date = ${BANGLADESH_TOMORROW_SQL} AND status = 'available'
    `);
    const [[reservations]] = await db.query(`
      SELECT
        COUNT(CASE WHEN r.status = 'reserved' THEN 1 END) AS total_reservations,
        COALESCE(SUM(r.status = 'cancelled'), 0) AS cancelled_reservations,
        COALESCE(SUM(r.status = 'collected'), 0) AS collected_reservations
      FROM reservations r
      INNER JOIN meals m ON m.id = r.meal_id
      WHERE m.meal_date = ${BANGLADESH_TOMORROW_SQL}
    `);

    return res.json({
      success: true,
      overview: {
        students: Number(users.students) || 0,
        staff: Number(users.staff) || 0,
        admins: Number(users.admins) || 0,
        published_meals: Number(meals.published_meals) || 0,
        meal_remaining: Number(meals.meal_remaining) || 0,
        total_reservations: Number(reservations.total_reservations) || 0,
        cancelled_reservations: Number(reservations.cancelled_reservations) || 0,
        collected_reservations: Number(reservations.collected_reservations) || 0
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function getUsers(req, res, next) {
  const search = cleanQueryValue(req.query.search);
  const role = cleanQueryValue(req.query.role).toLowerCase();
  const status = cleanQueryValue(req.query.status).toLowerCase();

  if (role && role !== "all" && !USER_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: "Invalid user role filter." });
  }
  if (status && status !== "all" && !USER_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid user status filter." });
  }

  try {
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push("(name LIKE ? OR email LIKE ? OR CAST(id AS CHAR) LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role && role !== "all") {
      conditions.push("role = ?");
      params.push(role);
    }
    if (status && status !== "all") {
      conditions.push("status = ?");
      params.push(status);
    }

    const [users] = await db.query(`
      SELECT id, name, email, role, gender, hall_name, status, last_login_at, created_at
      FROM users
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY created_at DESC
    `, params);

    return res.json({ success: true, count: users.length, users });
  } catch (error) {
    return next(error);
  }
}

async function getReservations(req, res, next) {
  const search = cleanQueryValue(req.query.search);
  const mealType = cleanQueryValue(req.query.meal_type).toLowerCase();
  const status = cleanQueryValue(req.query.status).toLowerCase();

  if (mealType && mealType !== "all" && !["breakfast", "lunch", "dinner"].includes(mealType)) {
    return res.status(400).json({ success: false, message: "Invalid meal filter." });
  }
  if (status && status !== "all" && !RESERVATION_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid reservation status filter." });
  }

  try {
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push("(u.name LIKE ? OR u.email LIKE ? OR CAST(u.id AS CHAR) LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (mealType && mealType !== "all") {
      conditions.push("m.meal_type = ?");
      params.push(mealType);
    }
    if (status && status !== "all") {
      conditions.push("r.status = ?");
      params.push(status);
    }

    const [reservations] = await db.query(`
      SELECT
        r.id, r.user_id, r.meal_id, r.hall_name, r.status, r.reserved_at, r.cancelled_at,
        r.collected_at,
        cl.staff_id AS collection_staff_id,
        u.name AS student_name, u.email AS student_email,
        m.meal_date, m.meal_type, m.menu_name
      FROM reservations r
      INNER JOIN users u ON u.id = r.user_id
      INNER JOIN meals m ON m.id = r.meal_id
      LEFT JOIN collection_logs cl ON cl.reservation_id = r.id
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY m.meal_date DESC, r.reserved_at DESC
    `, params);

    return res.json({ success: true, count: reservations.length, reservations });
  } catch (error) {
    return next(error);
  }
}

async function createStaff(req, res, next) {
  try {
    const { name, email, password, hall_name } = req.body;

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanHallName = typeof hall_name === "string" ? hall_name.trim() : "";

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

    if (!VALID_HALLS.includes(cleanHallName)) {
      return res.status(400).json({
        success: false,
        message: "A valid hall is required for staff accounts."
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
        message: "Password must be 8-72 characters with uppercase, lowercase and a number."
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query(
      `INSERT INTO users (name, email, password_hash, role, hall_name)
       VALUES (?, ?, ?, 'staff', ?)`,
      [cleanName, cleanEmail, passwordHash, cleanHallName]
    );

    return res.status(201).json({
      success: true,
      message: "Staff account created successfully.",
      user: {
        id: result.insertId,
        name: cleanName,
        email: cleanEmail,
        role: "staff",
        hall_name: cleanHallName
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

async function deleteUser(req, res, next) {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid user id."
    });
  }

  if (userId === Number(req.user.sub)) {
    return res.status(400).json({
      success: false,
      message: "You cannot delete your own account."
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, name, email, role FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );
    const target = rows[0];

    if (!target) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (!DELETABLE_ROLES.includes(target.role)) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be deleted from the dashboard."
      });
    }

    if (target.role === "student") {
      // The student's reservations are removed by ON DELETE CASCADE, so give
      // the seats they were still holding back to the meals first.
      await connection.query(
        `UPDATE meals m
         INNER JOIN (
           SELECT meal_id, COUNT(*) AS held
           FROM reservations
           WHERE user_id = ? AND status IN ('pending_payment', 'reserved')
           GROUP BY meal_id
         ) r ON r.meal_id = m.id
         SET m.reserved_count = GREATEST(CAST(m.reserved_count AS SIGNED) - r.held, 0)`,
        [userId]
      );
    }

    await connection.query("DELETE FROM users WHERE id = ?", [userId]);
    await connection.commit();

    return res.json({
      success: true,
      message: `${target.role === "staff" ? "Staff" : "Student"} account deleted successfully.`,
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    // collection_logs.staff_id still points at this staff member and the
    // database was not migrated yet (see database/migrations/004_*.sql).
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message:
          "This staff member has meal-collection history and cannot be deleted yet. " +
          "Run database/migrations/004_allow_staff_delete.sql once, then try again."
      });
    }

    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { getOverview, getUsers, getReservations, createStaff, deleteUser };
