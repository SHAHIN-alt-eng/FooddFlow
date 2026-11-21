"use strict";

const crypto = require("crypto");
const { db } = require("../config/db");
const { verifyBkashPayment } = require("../utils/paymentValidation");
const {
  BANGLADESH_NOW_SQL,
  BANGLADESH_TOMORROW_SQL
} = require("../utils/bangladeshTime");

const BKASH_BASE_URL = (
  process.env.BKASH_BASE_URL ||
  "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout"
).replace(/\/$/, "");
const DEMO_MODE = String(process.env.BKASH_DEMO_MODE || "").toLowerCase() === "true";
const HALLS_BY_GENDER = {
  male: [
    "Shaheed President Zia Hall",
    "Abdul Hamid Hall",
    "Tinshed Hall",
    "Shohidul Hall",
    "Shere-e-Bangla A K Fazlul Haque Hall",
    "Selim Hall",
    "Male Hall-1",
    "Male Hall-2",
    "Male Hall-3"
  ],
  female: ["Female Hall 1", "Female Hall 2"]
};
const FETCH_TIMEOUT_MS = 15000;

function configured() {
  return [
    "BKASH_APP_KEY",
    "BKASH_APP_SECRET",
    "BKASH_USERNAME",
    "BKASH_PASSWORD",
    "BKASH_CALLBACK_URL"
  ].every((key) => process.env[key]);
}

function safePaymentResponse(response) {
  const allowedFields = [
    "paymentID",
    "trxID",
    "transactionStatus",
    "amount",
    "currency",
    "merchantInvoiceNumber",
    "statusCode",
    "statusMessage"
  ];

  return Object.fromEntries(
    allowedFields
      .filter((field) => response[field] !== undefined)
      .map((field) => [field, response[field]])
  );
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || (data.statusCode && data.statusCode !== "0000")) {
      throw new Error(
        data.statusMessage || data.message || "bKash payment request failed."
      );
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function bkashRequest(path, body, token) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-APP-Key": process.env.BKASH_APP_KEY,
    Authorization: token
  };

  return fetchJson(`${BKASH_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

async function getToken() {
  const data = await fetchJson(`${BKASH_BASE_URL}/token/grant`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      username: process.env.BKASH_USERNAME,
      password: process.env.BKASH_PASSWORD
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET
    })
  });

  if (!data.id_token) {
    throw new Error("bKash did not return an access token.");
  }

  return data.id_token;
}

function paymentResultUrl(result, message, reservationId) {
  const url = new URL(
    process.env.CLIENT_PAYMENT_RESULT_URL ||
      "http://localhost:5500/payment-result.html"
  );
  url.searchParams.set("result", result);
  url.searchParams.set("message", message);
  if (reservationId) {
    url.searchParams.set("reservationId", String(reservationId));
  }
  return url.toString();
}

async function releaseUnpaidReservation(connection, paymentId, paymentStatus) {
  const [rows] = await connection.query(
    `SELECT p.id, p.status, r.id AS reservation_id, r.meal_id,
            r.status AS reservation_status
     FROM payments p
     INNER JOIN reservations r ON r.id = p.reservation_id
     WHERE p.id = ? OR p.bkash_payment_id = ?
     FOR UPDATE`,
    [paymentId, paymentId]
  );
  const payment = rows[0];

  if (!payment || payment.status !== "created") return;

  await connection.query("UPDATE payments SET status = ? WHERE id = ?", [
    paymentStatus,
    payment.id
  ]);

  if (payment.reservation_status === "pending_payment") {
    await connection.query(
      `UPDATE reservations
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [payment.reservation_id]
    );
    await connection.query(
      `UPDATE meals
       SET reserved_count = GREATEST(reserved_count - 1, 0)
       WHERE id = ?`,
      [payment.meal_id]
    );
  }
}

async function markPaymentUnsuccessful(paymentId, paymentStatus) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await releaseUnpaidReservation(connection, paymentId, paymentStatus);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createBkashPayment(req, res, next) {
  const studentId = Number(req.user?.sub);
  const mealId = Number(req.body?.meal_id);

  if (!Number.isInteger(studentId) || !Number.isInteger(mealId) || mealId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid meal is required."
    });
  }

  if (!DEMO_MODE && !configured()) {
    return res.status(503).json({
      success: false,
      message: "bKash sandbox is not configured. Add the BKASH_* values to the server environment."
    });
  }

  let connection;
  let payment;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [studentRows] = await connection.query(
      "SELECT gender FROM users WHERE id = ? LIMIT 1",
      [studentId]
    );
    const [mealRows] = await connection.query(
      `SELECT id, meal_date, hall_name, menu_name, price, capacity,
              reserved_count, status, reservation_deadline, published_by,
              (meal_date = ${BANGLADESH_TOMORROW_SQL}) AS is_tomorrow,
              (reservation_deadline <= ${BANGLADESH_NOW_SQL}) AS deadline_passed
       FROM meals
       WHERE id = ?
       FOR UPDATE`,
      [mealId]
    );
    const student = studentRows[0];
    const meal = mealRows[0];

    if (
      !student ||
      !meal ||
      meal.status !== "available" ||
      Number(meal.price) <= 0
    ) {
      throw Object.assign(new Error("This meal is not available for payment."), {
        statusCode: 409
      });
    }

    if (!HALLS_BY_GENDER[student.gender]?.includes(meal.hall_name)) {
      throw Object.assign(new Error("This meal is not available for your hall."), {
        statusCode: 403
      });
    }

    if (Number(meal.is_tomorrow) !== 1) {
      throw Object.assign(new Error("Only tomorrow's meal can be reserved."), {
        statusCode: 409
      });
    }

    if (!meal.reservation_deadline || Number(meal.deadline_passed)) {
      throw Object.assign(new Error("The reservation deadline has passed."), {
        statusCode: 409
      });
    }

    if (Number(meal.reserved_count) >= Number(meal.capacity)) {
      throw Object.assign(new Error("This meal is full."), { statusCode: 409 });
    }

    const [existingRows] = await connection.query(
      `SELECT id, status
       FROM reservations
       WHERE user_id = ? AND meal_id = ?
       LIMIT 1
       FOR UPDATE`,
      [studentId, mealId]
    );
    const existingReservation = existingRows[0];
    let existingReservationId = existingReservation?.id;

    if (existingReservation && existingReservation.status !== "cancelled") {
      throw Object.assign(
        new Error("You already have a reservation or payment in progress for this meal."),
        { statusCode: 409 }
      );
    }

    if (existingReservation) {
      const [activePayments] = await connection.query(
        `SELECT id
         FROM payments
         WHERE reservation_id = ? AND status = 'created'
         LIMIT 1
         FOR UPDATE`,
        [existingReservation.id]
      );

      if (activePayments[0]) {
        throw Object.assign(
          new Error("Your previous payment is still being verified. Please wait before retrying."),
          { statusCode: 409 }
        );
      }

      const [pendingRefunds] = await connection.query(
        `SELECT id
         FROM payments
         WHERE reservation_id = ?
           AND status = 'completed'
           AND refund_status = 'pending'
         LIMIT 1
         FOR UPDATE`,
        [existingReservation.id]
      );

      if (pendingRefunds[0]) {
        throw Object.assign(
          new Error("A refund for your previous payment is still pending. Please wait before paying again."),
          { statusCode: 409 }
        );
      }

      await connection.query(
        `UPDATE reservations
         SET hall_name = ?, status = 'pending_payment', reserved_at = CURRENT_TIMESTAMP,
             cancelled_at = NULL, collected_at = NULL, qr_token = NULL
         WHERE id = ?`,
        [meal.hall_name, existingReservation.id]
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO reservations (user_id, meal_id, hall_name, status)
         VALUES (?, ?, ?, 'pending_payment')`,
        [studentId, mealId, meal.hall_name]
      );
      existingReservationId = result.insertId;
    }

    const reservationId = existingReservation
      ? existingReservation.id
      : existingReservationId;
    const invoice = `FF-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const [result] = await connection.query(
      `INSERT INTO payments
       (reservation_id, student_id, receiver_staff_id, amount, merchant_invoice_number)
       VALUES (?, ?, ?, ?, ?)`,
      [reservationId, studentId, meal.published_by || null, meal.price, invoice]
    );

    await connection.query(
      "UPDATE meals SET reserved_count = reserved_count + 1 WHERE id = ?",
      [mealId]
    );
    await connection.commit();

    payment = {
      id: result.insertId,
      reservationId,
      invoice,
      amount: Number(meal.price)
    };
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }

  try {
    if (DEMO_MODE) {
      const demoPaymentId = `DEMO-${payment.id}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
      await db.query(
        "UPDATE payments SET bkash_payment_id = ?, raw_response = ? WHERE id = ?",
        [
          demoPaymentId,
          JSON.stringify({ mode: "local_demo", status: "created" }),
          payment.id
        ]
      );
      return res.status(201).json({
        success: true,
        payment: {
          id: payment.id,
          amount: payment.amount,
          invoice: payment.invoice,
          paymentID: demoPaymentId,
          demo: true
        }
      });
    }

    const token = await getToken();
    const data = await bkashRequest(
      "/create",
      {
        mode: "0011",
        payerReference: String(studentId),
        callbackURL: process.env.BKASH_CALLBACK_URL,
        amount: payment.amount.toFixed(2),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: payment.invoice
      },
      token
    );

    if (!data.paymentID || !data.bkashURL) {
      throw new Error("bKash did not return a valid payment session.");
    }

    await db.query(
      "UPDATE payments SET bkash_payment_id = ?, raw_response = ? WHERE id = ?",
      [data.paymentID, JSON.stringify(safePaymentResponse(data)), payment.id]
    );
    return res.status(201).json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        invoice: payment.invoice,
        bkashURL: data.bkashURL
      }
    });
  } catch (error) {
    try {
      await markPaymentUnsuccessful(payment.id, "failed");
    } catch (settlementError) {
      return next(settlementError);
    }
    return res.status(502).json({
      success: false,
      message: error.name === "AbortError"
        ? "bKash did not respond in time. Please try again."
        : error.message || "Could not connect to bKash sandbox."
    });
  }
}

async function completePayment(paymentId, responseData) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT p.id, p.status, p.amount, p.merchant_invoice_number,
              p.bkash_payment_id,
              r.id AS reservation_id, r.status AS reservation_status,
              r.qr_token
       FROM payments p
       INNER JOIN reservations r ON r.id = p.reservation_id
       WHERE p.bkash_payment_id = ?
       LIMIT 1
       FOR UPDATE`,
      [paymentId]
    );
    const payment = rows[0];

    if (!payment) {
      throw Object.assign(new Error("Payment was not found."), { statusCode: 404 });
    }

    if (payment.status === "completed") {
      await connection.commit();
      return payment;
    }

    if (payment.status !== "created" || payment.reservation_status !== "pending_payment") {
      throw Object.assign(new Error("This payment is no longer active."), {
        statusCode: 409
      });
    }

    verifyBkashPayment(payment, responseData);

    const qrToken = crypto.randomUUID();
    const [updatePayment] = await connection.query(
      `UPDATE payments
       SET status = 'completed', bkash_transaction_id = ?, raw_response = ?,
           paid_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'created'`,
      [
        responseData.trxID || null,
        JSON.stringify(safePaymentResponse(responseData)),
        payment.id
      ]
    );

    if (updatePayment.affectedRows !== 1) {
      throw Object.assign(new Error("Payment state changed while it was being verified."), {
        statusCode: 409
      });
    }

    const [updateReservation] = await connection.query(
      `UPDATE reservations
       SET status = 'reserved', qr_token = ?
       WHERE id = ? AND status = 'pending_payment'`,
      [qrToken, payment.reservation_id]
    );
    if (updateReservation.affectedRows !== 1) {
      throw Object.assign(new Error("Reservation state changed while payment was being verified."), {
        statusCode: 409
      });
    }
    payment.qr_token = qrToken;
    await connection.commit();
    return payment;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function executeBkashPayment(paymentId, expectedStudentId) {
  const [rows] = await db.query(
    `SELECT p.id, p.student_id, p.status, p.amount,
            p.merchant_invoice_number, p.bkash_payment_id,
            r.id AS reservation_id
     FROM payments p
     INNER JOIN reservations r ON r.id = p.reservation_id
     WHERE p.bkash_payment_id = ?
     LIMIT 1`,
    [paymentId]
  );
  const payment = rows[0];

  if (!payment) {
    throw Object.assign(new Error("Payment was not found."), { statusCode: 404 });
  }
  if (
    expectedStudentId &&
    Number(payment.student_id) !== Number(expectedStudentId)
  ) {
    throw Object.assign(new Error("You cannot verify another student's payment."), {
      statusCode: 403
    });
  }
  if (payment.status === "completed") return payment;
  if (payment.status !== "created") {
    throw Object.assign(new Error("This payment is no longer active."), {
      statusCode: 409
    });
  }

  if (DEMO_MODE && String(payment.bkash_payment_id).startsWith("DEMO-")) {
    await completePayment(paymentId, {
      amount: String(payment.amount),
      currency: "BDT",
      merchantInvoiceNumber: payment.merchant_invoice_number,
      paymentID: payment.bkash_payment_id,
      trxID: `DEMO-TRX-${payment.id}`,
      transactionStatus: "Completed"
    });
    return payment;
  }

  const token = await getToken();
  const data = await bkashRequest(
    `/execute/${encodeURIComponent(paymentId)}`,
    {},
    token
  );

  if (data.transactionStatus !== "Completed") {
    const failedStatus = String(data.transactionStatus || "").toLowerCase();
    if (["failed", "cancelled", "canceled"].includes(failedStatus)) {
      await markPaymentUnsuccessful(
        paymentId,
        failedStatus === "failed" ? "failed" : "cancelled"
      );
    }
    throw Object.assign(
      new Error(data.statusMessage || "Payment was not completed."),
      { statusCode: 409 }
    );
  }

  await completePayment(paymentId, data);
  return payment;
}

async function executeForStudent(req, res) {
  try {
    const payment = await executeBkashPayment(
      String(req.params.paymentId || "").trim(),
      req.user?.sub
    );
    return res.json({
      success: true,
      message: "Payment completed. Your meal reservation is confirmed.",
      reservationId: payment.reservation_id
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      success: false,
      message: error.message || "Payment could not be verified."
    });
  }
}

async function bkashCallback(req, res) {
  const paymentId = String(req.query.paymentID || "").trim();
  const callbackStatus = String(req.query.status || "").toLowerCase();

  if (paymentId && ["failure", "cancel", "cancelled"].includes(callbackStatus)) {
    try {
      await markPaymentUnsuccessful(paymentId, "cancelled");
    } catch (error) {
      return res.redirect(
        paymentResultUrl("failed", "We could not confirm the payment status. Please contact support.")
      );
    }
    return res.redirect(paymentResultUrl("failed", "Payment was cancelled or failed."));
  }

  if (!paymentId || callbackStatus !== "success") {
    return res.redirect(
      paymentResultUrl("failed", "Payment was cancelled or could not be verified.")
    );
  }

  try {
    const payment = await executeBkashPayment(paymentId);
    return res.redirect(
      paymentResultUrl(
        "success",
        "Payment completed and reservation confirmed.",
        payment.reservation_id
      )
    );
  } catch (error) {
    return res.redirect(
      paymentResultUrl("failed", "Payment could not be verified. Please contact support if you were charged.")
    );
  }
}

async function getReceivedPayments(req, res, next) {
  try {
    const [payments] = await db.query(
      `SELECT p.id, p.amount, p.status, p.merchant_invoice_number,
              p.bkash_transaction_id, p.paid_at, p.refund_status,
              m.menu_name, m.meal_date, u.name AS student_name
       FROM payments p
       INNER JOIN reservations r ON r.id = p.reservation_id
       INNER JOIN meals m ON m.id = r.meal_id
       INNER JOIN users u ON u.id = p.student_id
       WHERE p.receiver_staff_id = ? AND p.status = 'completed'
       ORDER BY p.created_at DESC`,
      [req.user.sub]
    );
    return res.json({ success: true, payments });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createBkashPayment,
  executeForStudent,
  bkashCallback,
  getReceivedPayments
};
