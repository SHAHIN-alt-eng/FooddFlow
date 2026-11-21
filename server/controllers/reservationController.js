"use strict";

const { db } = require("../config/db");
const crypto = require("crypto");
const {
  BANGLADESH_DATE_SQL,
  BANGLADESH_NOW_SQL
} = require("../utils/bangladeshTime");

const ACTIVE_STATUS = "reserved";
const CANCELLED_STATUS = "cancelled";
const COLLECTED_STATUS = "collected";
const HALLS_BY_GENDER = {
  male: ["Shaheed President Zia Hall", "Abdul Hamid Hall", "Tinshed Hall", "Shohidul Hall", "Shere-e-Bangla A K Fazlul Haque Hall", "Selim Hall", "Male Hall-1", "Male Hall-2", "Male Hall-3"],
  female: ["Female Hall 1", "Female Hall 2"]
};

function getUserId(req) {
  const userId = Number(req.user?.sub);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function getId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function sendInvalidId(res, label) {
  return res.status(400).json({
    success: false,
    message: `Invalid ${label} ID.`
  });
}

function handleReservationSchemaError(error, res, next) {
  if (error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_NO_SUCH_TABLE") {
    return res.status(503).json({
      success: false,
      message: "The database is missing required reservation/payment fields. Apply the pending SQL migrations, then retry."
    });
  }

  return next(error);
}

async function reserveMeal(req, res, next) {
  const userId = getUserId(req);
  const mealId = getId(req.body?.meal_id);
  const hallName = typeof req.body?.hall_name === "string" ? req.body.hall_name.trim() : "";

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authenticated user information is required."
    });
  }

  if (!mealId) {
    return sendInvalidId(res, "meal");
  }

  const [users] = await db.query("SELECT gender FROM users WHERE id = ? LIMIT 1", [userId]);
  const gender = users[0]?.gender;

  if (!gender || !HALLS_BY_GENDER[gender]?.includes(hallName)) {
    return res.status(400).json({
      success: false,
      message: "Please select a valid hall for your gender."
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [mealRows] = await connection.query(
      `SELECT
        id,
        meal_date,
        meal_type,
        hall_name,
        menu_name,
        price,
        capacity,
        reserved_count,
        reservation_deadline,
        status,
        (reservation_deadline <= ${BANGLADESH_NOW_SQL}) AS deadline_passed
      FROM meals
      WHERE id = ?
      FOR UPDATE`,
      [mealId]
    );

    const meal = mealRows[0];

    if (!meal) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Meal not found."
      });
    }

    if (meal.hall_name !== hallName) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This meal is published for a different hall."
      });
    }

    if (meal.status !== "available") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This meal is no longer available for reservation."
      });
    }

    if (Number(meal.price) > 0) {
      await connection.rollback();

      return res.status(402).json({
        success: false,
        message: "This meal requires bKash checkout."
      });
    }

    if (Number(meal.deadline_passed)) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "The reservation deadline for this meal has passed."
      });
    }

    const [existingRows] = await connection.query(
      `SELECT id, status
       FROM reservations
       WHERE user_id = ?
       AND meal_id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId, mealId]
    );

    const existingReservation = existingRows[0];

    if (existingReservation?.status === ACTIVE_STATUS) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "You already have an active reservation for this meal."
      });
    }

    if (Number(meal.reserved_count) >= Number(meal.capacity)) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This meal has reached its reservation capacity."
      });
    }

    let reservationId;
    let qrToken;

    if (existingReservation) {
      qrToken = crypto.randomUUID();

      await connection.query(
        `UPDATE reservations
         SET
           status = ?,
           hall_name = ?,
           reserved_at = CURRENT_TIMESTAMP,
           cancelled_at = NULL,
           collected_at = NULL,
           qr_token = ?
         WHERE id = ?`,
        [ACTIVE_STATUS, hallName, qrToken, existingReservation.id]
      );

      reservationId = existingReservation.id;
    } else {
      qrToken = crypto.randomUUID();

      const [reservationResult] = await connection.query(
        `INSERT INTO reservations
         (user_id, meal_id, hall_name, qr_token, status)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, mealId, hallName, qrToken, ACTIVE_STATUS]
      );

      reservationId = reservationResult.insertId;
    }

    await connection.query(
      `UPDATE meals
       SET reserved_count = reserved_count + 1
       WHERE id = ?`,
      [mealId]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Meal reserved successfully.",
      reservation: {
        id: reservationId,
        user_id: userId,
        meal_id: mealId,
        hall_name: hallName,
        qr_token: qrToken,
        status: ACTIVE_STATUS,
        meal
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "You already have an active reservation for this meal."
      });
    }

    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function getMyReservations(req, res, next) {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authenticated user information is required."
    });
  }

  try {
    const [reservations] = await db.query(
      `SELECT
        r.id,
        r.user_id,
        r.meal_id,
        r.hall_name,
        r.qr_token,
        r.status,
        r.reserved_at,
        r.cancelled_at,
        r.collected_at,
        m.meal_date,
        m.meal_type,
        m.menu_name,
        m.description,
        m.reservation_deadline,
        p.amount AS payment_amount,
        p.refund_status,
        p.refunded_at
      FROM reservations r
      INNER JOIN meals m ON m.id = r.meal_id
      LEFT JOIN payments p ON p.id = (
        SELECT latest_payment.id
        FROM payments latest_payment
        WHERE latest_payment.reservation_id = r.id
        ORDER BY latest_payment.created_at DESC, latest_payment.id DESC
        LIMIT 1
      )
      WHERE r.user_id = ?
      ORDER BY m.meal_date ASC, r.reserved_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      count: reservations.length,
      reservations
    });
  } catch (error) {
    return handleReservationSchemaError(error, res, next);
  }
}

async function getReservationById(req, res, next) {
  const userId = getUserId(req);
  const reservationId = getId(req.params.id);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authenticated user information is required."
    });
  }

  if (!reservationId) {
    return sendInvalidId(res, "reservation");
  }

  try {
    const [reservations] = await db.query(
      `SELECT
        r.id,
        r.user_id,
        r.meal_id,
        r.hall_name,
        r.qr_token,
        r.status,
        r.reserved_at,
        r.cancelled_at,
        r.collected_at,
        m.meal_date,
        m.meal_type,
        m.menu_name,
        m.description,
        m.reservation_deadline,
        p.amount AS payment_amount,
        p.refund_status,
        p.refunded_at
      FROM reservations r
      INNER JOIN meals m ON m.id = r.meal_id
      LEFT JOIN payments p ON p.id = (
        SELECT latest_payment.id
        FROM payments latest_payment
        WHERE latest_payment.reservation_id = r.id
        ORDER BY latest_payment.created_at DESC, latest_payment.id DESC
        LIMIT 1
      )
      WHERE r.id = ?
        AND r.user_id = ?
      LIMIT 1`,
      [reservationId, userId]
    );

    if (!reservations[0]) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found."
      });
    }

    return res.status(200).json({
      success: true,
      reservation: reservations[0]
    });
  } catch (error) {
    return handleReservationSchemaError(error, res, next);
  }
}

async function cancelReservation(req, res, next) {
  const userId = getUserId(req);
  const reservationId = getId(req.params.id);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authenticated user information is required."
    });
  }

  if (!reservationId) {
    return sendInvalidId(res, "reservation");
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [reservationRows] = await connection.query(
      `SELECT
        r.id,
        r.meal_id,
        r.status,
        m.reservation_deadline,
        (m.reservation_deadline <= ${BANGLADESH_NOW_SQL}) AS deadline_passed
       FROM reservations r
       INNER JOIN meals m ON m.id = r.meal_id
       WHERE r.id = ?
         AND r.user_id = ?
       FOR UPDATE`,
      [reservationId, userId]
    );

    const reservation = reservationRows[0];

    if (!reservation) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Reservation not found."
      });
    }

    if (reservation.status !== ACTIVE_STATUS) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This reservation is already cancelled or completed."
      });
    }

    if (
      reservation.deadline_passed
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "The cancellation deadline for this meal has passed."
      });
    }

    const [mealRows] = await connection.query(
      `SELECT id
       FROM meals
       WHERE id = ?
       FOR UPDATE`,
      [reservation.meal_id]
    );

    if (!mealRows[0]) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Related meal not found."
      });
    }

    await connection.query(
      `UPDATE reservations
       SET
         status = ?,
         cancelled_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [CANCELLED_STATUS, reservationId]
    );

    await connection.query(
      `UPDATE meals
       SET reserved_count = GREATEST(reserved_count - 1, 0)
       WHERE id = ?`,
      [reservation.meal_id]
    );

    const [paymentRows] = await connection.query(
      `SELECT id, amount, status, refund_status FROM payments
       WHERE reservation_id = ? AND status = 'completed'
         AND refund_status <> 'refunded'
       ORDER BY paid_at DESC, id DESC
       FOR UPDATE`,
      [reservationId]
    );
    let refundAmount = 0;

    if (paymentRows.length) {
      refundAmount = paymentRows.reduce(
        (total, payment) => total + (Number(payment.amount) || 0),
        0
      );
      await connection.query(
        `UPDATE payments
         SET refund_status = 'pending', refunded_at = NULL, refund_reference = NULL
         WHERE reservation_id = ? AND status = 'completed'
           AND refund_status <> 'refunded'`,
        [reservationId]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: refundAmount > 0
        ? `Reservation cancelled. A refund request for ৳${refundAmount.toFixed(2)} is pending manual processing; bKash does not refund automatically.`
        : "Reservation cancelled successfully."
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function collectMeal(req, res, next) {
  const qrToken = String(req.body?.qr_token || "").trim();

  if (!qrToken) {
    return res.status(400).json({
      success: false,
      message: "QR token is required."
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [reservationRows] = await connection.query(
      `SELECT
        r.id,
        r.user_id,
        r.meal_id,
        r.hall_name,
        r.qr_token,
        r.status,
        r.collected_at,
        u.name AS student_name,
        u.email AS student_email,
        m.meal_date,
        m.meal_type,
        m.menu_name,
        (m.meal_date = ${BANGLADESH_DATE_SQL}) AS is_today
      FROM reservations r
      INNER JOIN users u ON u.id = r.user_id
      INNER JOIN meals m ON m.id = r.meal_id
      WHERE r.qr_token = ?
      LIMIT 1
      FOR UPDATE`,
      [qrToken]
    );

    const reservation = reservationRows[0];

    if (!reservation) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Invalid QR code."
      });
    }

    if (reservation.status === CANCELLED_STATUS) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This reservation has been cancelled."
      });
    }

    if (reservation.status === COLLECTED_STATUS) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This meal has already been collected."
      });
    }

    if (reservation.status !== ACTIVE_STATUS) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This reservation is not eligible for collection."
      });
    }

    // Staff can only collect meals reserved at their own hall.
    if (req.user?.role === "staff") {
      const [staffRows] = await connection.query(
        "SELECT hall_name FROM users WHERE id = ? LIMIT 1",
        [getUserId(req)]
      );
      const staffHall = staffRows[0]?.hall_name || "";

      if (!staffHall || reservation.hall_name !== staffHall) {
        await connection.rollback();

        return res.status(403).json({
          success: false,
          message: "This reservation belongs to a different hall."
        });
      }
    }

    if (Number(reservation.is_today) !== 1) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This QR code is not valid for collection today."
      });
    }

    await connection.query(
      `UPDATE reservations
       SET
         status = ?,
         collected_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [COLLECTED_STATUS, reservation.id]
    );

    await connection.query(
      `INSERT INTO collection_logs
       (reservation_id, staff_id, qr_token, status)
       VALUES (?, ?, ?, 'collected')`,
      [reservation.id, getUserId(req), reservation.qr_token]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Meal collected successfully.",
      reservation: {
        id: reservation.id,
        user_id: reservation.user_id,
        student_name: reservation.student_name,
        student_email: reservation.student_email,
        meal_id: reservation.meal_id,
        hall_name: reservation.hall_name,
        meal_date: reservation.meal_date,
        meal_type: reservation.meal_type,
        menu_name: reservation.menu_name,
        status: COLLECTED_STATUS
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  reserveMeal,
  getMyReservations,
  getReservationById,
  cancelReservation,
  collectMeal
};
