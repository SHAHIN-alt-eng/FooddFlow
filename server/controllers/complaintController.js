"use strict";

const { db } = require("../config/db");

const COMPLAINT_STATUSES = ["pending", "in_progress", "resolved"];

function cleanQueryValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function complaintIdFromRequest(req) {
    const complaintId = Number(req.params.id);
    return Number.isInteger(complaintId) && complaintId > 0 ? complaintId : null;
}

async function getUserHallName(userId) {
    const [users] = await db.query(
        "SELECT hall_name FROM users WHERE id = ? LIMIT 1",
        [userId]
    );

    return users[0]?.hall_name || "";
}


/* =========================================================
   FOODFLOW | COMPLAINT CONTROLLER
   Student complaint box, visible to staff (own hall) & admin
========================================================= */


/* =========================================================
   CREATE COMPLAINT
   POST /api/complaints
   Students only.
========================================================= */

async function createComplaint(req, res, next) {
    try {
        const { subject, message } = req.body;

        const cleanSubject = typeof subject === "string" ? subject.trim() : "";
        const cleanMessage = typeof message === "string" ? message.trim() : "";

        if (!cleanSubject || !cleanMessage) {
            return res.status(400).json({
                success: false,
                message: "Subject and message are required."
            });
        }

        if (cleanSubject.length > 150) {
            return res.status(400).json({
                success: false,
                message: "Subject must be 150 characters or fewer."
            });
        }

        const hallName = await getUserHallName(req.user.sub);

        if (!hallName) {
            return res.status(400).json({
                success: false,
                message: "Your account is not assigned to a hall yet. Please contact an admin."
            });
        }

        const [result] = await db.query(`
            INSERT INTO complaints (student_id, hall_name, subject, message)
            VALUES (?, ?, ?, ?)
        `, [req.user.sub, hallName, cleanSubject, cleanMessage]);

        return res.status(201).json({
            success: true,
            message: "Your complaint has been submitted.",
            complaint: {
                id: result.insertId,
                hall_name: hallName,
                subject: cleanSubject,
                message: cleanMessage,
                status: "pending",
                staff_response: null,
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        return next(error);
    }
}


/* =========================================================
   GET MY COMPLAINTS
   GET /api/complaints/my
   Students only — their own complaint history.
========================================================= */

async function getMyComplaints(req, res, next) {
    try {
        const [complaints] = await db.query(`
            SELECT id, subject, message, status, staff_response, created_at, updated_at
            FROM complaints
            WHERE student_id = ?
            ORDER BY created_at DESC
        `, [req.user.sub]);

        return res.status(200).json({
            success: true,
            count: complaints.length,
            complaints
        });
    } catch (error) {
        return next(error);
    }
}


/* =========================================================
   GET COMPLAINTS
   GET /api/complaints
   Staff: only complaints from their own hall.
   Admin: every complaint, optionally filtered by hall/status.
========================================================= */

async function getComplaints(req, res, next) {
    try {
        const status = cleanQueryValue(req.query.status).toLowerCase();

        if (status && status !== "all" && !COMPLAINT_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint status filter."
            });
        }

        const filters = [];
        const params = [];

        if (req.user.role === "staff") {
            const staffHall = await getUserHallName(req.user.sub);

            if (!staffHall) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is not assigned to a hall."
                });
            }

            filters.push("c.hall_name = ?");
            params.push(staffHall);
        } else {
            // Admin can optionally narrow down by hall.
            const hallName = cleanQueryValue(req.query.hall_name);
            if (hallName) {
                filters.push("c.hall_name = ?");
                params.push(hallName);
            }
        }

        if (status && status !== "all") {
            filters.push("c.status = ?");
            params.push(status);
        }

        const [complaints] = await db.query(`
            SELECT
                c.id,
                c.hall_name,
                c.subject,
                c.message,
                c.status,
                c.staff_response,
                c.created_at,
                c.updated_at,
                u.id AS student_id,
                u.name AS student_name,
                u.email AS student_email
            FROM complaints c
            INNER JOIN users u ON u.id = c.student_id
            ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
            ORDER BY
                FIELD(c.status, 'pending', 'in_progress', 'resolved'),
                c.created_at DESC
        `, params);

        return res.status(200).json({
            success: true,
            count: complaints.length,
            complaints
        });
    } catch (error) {
        return next(error);
    }
}


/* =========================================================
   RESPOND / UPDATE COMPLAINT STATUS
   PUT /api/complaints/:id
   Staff (own hall only) & admin.
========================================================= */

async function updateComplaint(req, res, next) {
    try {
        const complaintId = complaintIdFromRequest(req);

        if (!complaintId) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID."
            });
        }

        const { status, staff_response } = req.body;

        if (status !== undefined && !COMPLAINT_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint status."
            });
        }

        const [existingRows] = await db.query(
            "SELECT id, hall_name, status FROM complaints WHERE id = ? LIMIT 1",
            [complaintId]
        );
        const existingComplaint = existingRows[0];

        if (!existingComplaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found."
            });
        }

        if (req.user.role === "staff") {
            const staffHall = await getUserHallName(req.user.sub);

            if (!staffHall || existingComplaint.hall_name !== staffHall) {
                return res.status(403).json({
                    success: false,
                    message: "You can only manage complaints from your own hall."
                });
            }
        }

        const updatedStatus = status !== undefined ? status : existingComplaint.status;
        const updatedResponse = staff_response !== undefined
            ? (typeof staff_response === "string" ? staff_response.trim() || null : null)
            : undefined;

        const setClauses = ["status = ?"];
        const params = [updatedStatus];

        if (updatedResponse !== undefined) {
            setClauses.push("staff_response = ?");
            params.push(updatedResponse);
        }

        if (updatedStatus === "resolved") {
            setClauses.push("resolved_by = ?", "resolved_at = NOW()");
            params.push(req.user.sub);
        }

        params.push(complaintId);

        await db.query(`
            UPDATE complaints
            SET ${setClauses.join(", ")}
            WHERE id = ?
        `, params);

        return res.status(200).json({
            success: true,
            message: "Complaint updated successfully."
        });
    } catch (error) {
        return next(error);
    }
}


module.exports = {
    createComplaint,
    getMyComplaints,
    getComplaints,
    updateComplaint
};
