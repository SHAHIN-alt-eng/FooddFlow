"use strict";

const { db } = require("../config/db");
const {
    BANGLADESH_TOMORROW_SQL,
    getBangladeshTomorrowDate,
    getMealReservationDeadline
} = require("../utils/bangladeshTime");
const { HALLS, normalizeHallName } = require("../utils/halls");

const MEAL_TYPES = ["breakfast", "lunch", "dinner"];
const MEAL_STATUSES = ["available", "closed", "cancelled"];

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
}

function formatDateValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    return typeof value === "string" ? value.trim() : "";
}

function normalizeDeadline(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const deadline = new Date(value);

    return Number.isNaN(deadline.getTime()) ? undefined : value;
}

function mealIdFromRequest(req) {
    const mealId = Number(req.params.id);

    return Number.isInteger(mealId) && mealId > 0 ? mealId : null;
}

function validHall(value) {
    return Boolean(normalizeHallName(value));
}

/* ---------------------------------------------------------
   Look up the hall a staff/admin/student account belongs to.
   Used to keep every hall's meals isolated from other halls.
--------------------------------------------------------- */
async function getUserHallName(userId) {
    const [users] = await db.query(
        "SELECT hall_name FROM users WHERE id = ? LIMIT 1",
        [userId]
    );

    return normalizeHallName(users[0]?.hall_name);
}


/* =========================================================
   FOODFLOW | MEAL CONTROLLER
   Module 2 - Hall Meal Management
========================================================= */


/* =========================================================
   GET AVAILABLE MEALS
   GET /api/meals
========================================================= */

async function getMeals(req, res, next) {

    try {

        const requestedType = typeof req.query.type === "string"
            ? req.query.type.trim().toLowerCase()
            : "";
        const requestedDate = typeof req.query.date === "string"
            ? req.query.date.trim()
            : "";

        if (requestedType && !MEAL_TYPES.includes(requestedType)) {
            return res.status(400).json({
                success: false,
                message: "Meal type must be breakfast, lunch or dinner."
            });
        }

        if (requestedDate && !isValidDate(requestedDate)) {
            return res.status(400).json({
                success: false,
                message: "Date must use a valid YYYY-MM-DD format."
            });
        }

        const filters = ["status = 'available'"];
        const queryParams = [];

        if (requestedType) {
            filters.push("meal_type = ?");
            queryParams.push(requestedType);
        }

        if (requestedDate) {
            filters.push("meal_date = ?");
            queryParams.push(requestedDate);
        }

        if (req.user?.role === "student") {
            const [users] = await db.query("SELECT gender FROM users WHERE id = ? LIMIT 1", [req.user.sub]);
            const gender = users[0]?.gender;
            const allowedHalls = gender === "female" ? HALLS.slice(-2) : HALLS.slice(0, -2);
            filters.push(`hall_name IN (${allowedHalls.map(() => "?").join(",")})`);
            queryParams.push(...allowedHalls);
        }

        // Staff must only ever see meals belonging to their own hall.
        if (req.user?.role === "staff") {
            const staffHall = await getUserHallName(req.user.sub);

            if (!validHall(staffHall)) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is not assigned to a hall."
                });
            }

            filters.push("hall_name = ?");
            queryParams.push(staffHall);
        }

        const [meals] = await db.query(`
            SELECT
                id,
                meal_date,
                meal_type,
                hall_name,
                menu_name,
                description,
                price,
                capacity,
                reserved_count,
                reservation_deadline,
                status,
                created_at,
                updated_at
            FROM meals
            WHERE ${filters.join(" AND ")}
            ORDER BY
                meal_date ASC,
                FIELD(
                    meal_type,
                    'breakfast',
                    'lunch',
                    'dinner'
                )
        `, queryParams);


        return res.status(200).json({

            success: true,

            count: meals.length,

            meals

        });

    } catch (error) {

        return next(error);

    }
}


/* =========================================================
   GET NEXT DAY'S MEALS
   GET /api/meals/today (legacy route name)
========================================================= */

async function getTodaysMeals(req, res, next) {

    try {

        const queryParams = [];
        let hallFilter = "";

        if (req.user?.role === "student") {
            const [users] = await db.query("SELECT gender FROM users WHERE id = ? LIMIT 1", [req.user.sub]);
            const allowedHalls = users[0]?.gender === "female" ? HALLS.slice(-2) : HALLS.slice(0, -2);
            hallFilter = `AND hall_name IN (${allowedHalls.map(() => "?").join(",")})`;
            queryParams.push(...allowedHalls);
        }

        // Staff must only ever see today's meals for their own hall.
        if (req.user?.role === "staff") {
            const staffHall = await getUserHallName(req.user.sub);

            if (!validHall(staffHall)) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is not assigned to a hall."
                });
            }

            hallFilter = "AND hall_name = ?";
            queryParams.push(staffHall);
        }

        const [meals] = await db.query(`
            SELECT
                id,
                meal_date,
                meal_type,
                hall_name,
                menu_name,
                description,
                price,
                capacity,
                reserved_count,
                reservation_deadline,
                status
            FROM meals
            WHERE meal_date = ${BANGLADESH_TOMORROW_SQL}
            AND status = 'available'
            ${hallFilter}
            ORDER BY
                FIELD(
                    meal_type,
                    'breakfast',
                    'lunch',
                    'dinner'
                )
        `, queryParams);
        return res.status(200).json({

            success: true,

            count: meals.length,

            meals

        });

    } catch (error) {

        return next(error);

    }
}


/* =========================================================
   GET SINGLE MEAL
   GET /api/meals/:id
========================================================= */

async function getMealById(req, res, next) {

    try {

        const mealId = mealIdFromRequest(req);


        if (!mealId) {

            return res.status(400).json({

                success: false,

                message: "Invalid meal ID."

            });
        }


        const [meals] = await db.query(`
            SELECT
                id,
                meal_date,
                meal_type,
                hall_name,
                menu_name,
                description,
                price,
                capacity,
                reserved_count,
                reservation_deadline,
                status,
                created_at,
                updated_at
            FROM meals
            WHERE id = ?
            LIMIT 1
        `, [mealId]);


        const meal = meals[0];


        if (!meal) {

            return res.status(404).json({

                success: false,

                message: "Meal not found."

            });
        }

        // Staff can only look up meals that belong to their own hall.
        if (req.user?.role === "staff") {
            const staffHall = await getUserHallName(req.user.sub);

            if (!validHall(staffHall) || normalizeHallName(meal.hall_name) !== staffHall) {
                return res.status(404).json({
                    success: false,
                    message: "Meal not found."
                });
            }
        }

        // Students can only look up meals from halls available to their gender.
        if (req.user?.role === "student") {
            const [users] = await db.query("SELECT gender FROM users WHERE id = ? LIMIT 1", [req.user.sub]);
            const allowedHalls = users[0]?.gender === "female" ? HALLS.slice(-2) : HALLS.slice(0, -2);

            if (!allowedHalls.includes(meal.hall_name)) {
                return res.status(404).json({
                    success: false,
                    message: "Meal not found."
                });
            }
        }


        return res.status(200).json({

            success: true,

            meal

        });

    } catch (error) {

        return next(error);

    }
}


/* =========================================================
   CREATE MEAL
   POST /api/meals

   Intended for staff/admin management.
========================================================= */

async function createMeal(req, res, next) {

    try {

        const {
            meal_date,
            meal_type,
            hall_name,
            menu_name,
            description,
            price,
            capacity,
            reservation_deadline
        } = req.body;


        const cleanDate =
            typeof meal_date === "string"
                ? meal_date.trim()
                : "";

        let cleanHallName = normalizeHallName(hall_name);
        if (req.user?.role === "staff") {
            cleanHallName = await getUserHallName(req.user.sub);
        }

        if (!validHall(cleanHallName)) {
            return res.status(400).json({ success: false, message: "A valid hall is required." });
        }


        const cleanType =
            typeof meal_type === "string"
                ? meal_type.trim().toLowerCase()
                : "";


        const cleanMenuName =
            typeof menu_name === "string"
                ? menu_name.trim()
                : "";


        const cleanDescription =
            typeof description === "string"
                ? description.trim()
                : null;


        const mealCapacity =
            Number(capacity);

        const mealPrice = Number(price);


        /* ---------------------------------------------
           Required Fields
        --------------------------------------------- */

        if (
            !cleanDate ||
            !cleanType ||
            !cleanMenuName
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Meal date, meal type and menu name are required."

            });
        }


        /* ---------------------------------------------
           Meal Type Validation
        --------------------------------------------- */

        if (!MEAL_TYPES.includes(cleanType)) {

            return res.status(400).json({

                success: false,

                message:
                    "Meal type must be breakfast, lunch or dinner."

            });
        }


        /* ---------------------------------------------
           Capacity Validation
        --------------------------------------------- */

        if (
            !Number.isInteger(mealCapacity) ||
            mealCapacity < 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Capacity must be a valid non-negative integer."

            });
        }

        if (!Number.isFinite(mealPrice) || mealPrice <= 0 || mealPrice > 99999.99) {
            return res.status(400).json({ success: false, message: "Meal price must be between ৳0.01 and ৳99,999.99." });
        }


        /* ---------------------------------------------
           Date Validation
        --------------------------------------------- */

        if (!isValidDate(cleanDate)) {

            return res.status(400).json({

                success: false,

                message:
                    "Meal date must use YYYY-MM-DD format."

            });
        }

        if (cleanDate < getBangladeshTomorrowDate()) {
            return res.status(400).json({
                success: false,
                message: "Meals must be published at least one day in advance. Choose tomorrow or a future date."
            });
        }


        // The booking/cancellation cutoff is fixed at 11:30 PM on the day
        // before the meal, regardless of the optional client form value.
        const cleanDeadline = getMealReservationDeadline(cleanDate);


        /* ---------------------------------------------
           Insert Meal
        --------------------------------------------- */

        const [result] = await db.query(`
            INSERT INTO meals (
                meal_date,
                meal_type,
                hall_name,
                menu_name,
                description,
                price,
                capacity,
                reservation_deadline,
                published_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cleanDate,
            cleanType,
            cleanHallName,
            cleanMenuName,
            cleanDescription || null,
            mealPrice,
            mealCapacity,
            cleanDeadline,
            req.user?.sub || null
        ]);


        return res.status(201).json({

            success: true,

            message:
                "Meal created successfully.",

            meal: {

                id: result.insertId,

                meal_date: cleanDate,

                meal_type: cleanType,
                hall_name: cleanHallName,

                menu_name: cleanMenuName,

                description:
                    cleanDescription || null,

                price: mealPrice,

                capacity: mealCapacity,

                reserved_count: 0,

                reservation_deadline: cleanDeadline,

                status: "available"

            }

        });

    } catch (error) {


        /* ---------------------------------------------
           Duplicate Meal
        --------------------------------------------- */

        if (error.code === "ER_DUP_ENTRY") {

            return res.status(409).json({

                success: false,

                message:
                    "A meal of this type already exists for this date."

            });
        }


        return next(error);

    }
}


/* =========================================================
   UPDATE MEAL
   PUT /api/meals/:id
========================================================= */

async function updateMeal(req, res, next) {

    try {

        const mealId = mealIdFromRequest(req);


        if (!mealId) {

            return res.status(400).json({

                success: false,

                message: "Invalid meal ID."

            });
        }


        const {
            meal_date,
            meal_type,
            menu_name,
            description,
            price,
            capacity,
            reservation_deadline,
            status
        } = req.body;


        if (status !== undefined && !MEAL_STATUSES.includes(status)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid meal status."

            });
        }


        const [existingRows] = await db.query(
            `
            SELECT
                id,
                meal_date,
                meal_type,
                hall_name,
                menu_name,
                description,
                price,
                capacity,
                reserved_count,
                reservation_deadline,
                status
            FROM meals
            WHERE id = ?
            LIMIT 1
            `,
            [mealId]
        );


        const existingMeal =
            existingRows[0];


        if (!existingMeal) {

            return res.status(404).json({

                success: false,

                message:
                    "Meal not found."

            });
        }

        // Staff may only edit meals that belong to their own hall.
        if (req.user?.role === "staff") {
            const staffHall = await getUserHallName(req.user.sub);

            if (!validHall(staffHall) || normalizeHallName(existingMeal.hall_name) !== staffHall) {
                return res.status(403).json({
                    success: false,
                    message: "You can only manage meals for your own hall."
                });
            }
        }


        const updatedDate =
            meal_date !== undefined
                ? formatDateValue(meal_date)
                : formatDateValue(existingMeal.meal_date);


        const updatedType =
            meal_type !== undefined
                ? String(meal_type).trim().toLowerCase()
                : existingMeal.meal_type;


        const updatedMenuName =
            menu_name !== undefined
                ? String(menu_name).trim()
                : existingMeal.menu_name;


        const updatedDescription =
            description !== undefined
                ? String(description).trim()
                : existingMeal.description;


        const updatedCapacity =
            capacity !== undefined
                ? Number(capacity)
                : existingMeal.capacity;

        const updatedPrice = price !== undefined ? Number(price) : Number(existingMeal.price);


        const updatedDeadline =
            reservation_deadline !== undefined
                ? reservation_deadline
                : existingMeal.reservation_deadline;


        const updatedStatus =
            status !== undefined
                ? status
                : existingMeal.status;


        /* ---------------------------------------------
           Validation
        --------------------------------------------- */

        if (!MEAL_TYPES.includes(updatedType)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid meal type."

            });
        }


        if (!isValidDate(updatedDate)) {
            return res.status(400).json({
                success: false,
                message: "Meal date must use a valid YYYY-MM-DD format."
            });
        }


        if (!updatedMenuName) {

            return res.status(400).json({

                success: false,

                message:
                    "Menu name cannot be empty."

            });
        }

        if (!Number.isFinite(updatedPrice) || updatedPrice <= 0 || updatedPrice > 99999.99) {
            return res.status(400).json({ success: false, message: "Meal price must be between ৳0.01 and ৳99,999.99." });
        }

        const cleanDeadline = getMealReservationDeadline(updatedDate);

        if (updatedDate < getBangladeshTomorrowDate()) {
            return res.status(400).json({
                success: false,
                message: "Meals must be scheduled for tomorrow or a future date."
            });
        }


        if (
            !Number.isInteger(updatedCapacity) ||
            updatedCapacity < existingMeal.reserved_count
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Capacity cannot be less than reserved count."

            });
        }


        /* ---------------------------------------------
           Update
        --------------------------------------------- */

        await db.query(`
            UPDATE meals
            SET
                meal_date = ?,
                meal_type = ?,
                menu_name = ?,
                description = ?,
                price = ?,
                capacity = ?,
                reservation_deadline = ?,
                status = ?
            WHERE id = ?
        `, [
            updatedDate,
            updatedType,
            updatedMenuName,
            updatedDescription || null,
            updatedPrice,
            updatedCapacity,
            cleanDeadline,
            updatedStatus,
            mealId
        ]);


        return res.status(200).json({

            success: true,

            message:
                "Meal updated successfully."

        });

    } catch (error) {

        if (error.code === "ER_DUP_ENTRY") {

            return res.status(409).json({

                success: false,

                message:
                    "Another meal of this type already exists for this date."

            });
        }


        return next(error);

    }
}


/* =========================================================
   DELETE / CANCEL MEAL
   DELETE /api/meals/:id

   We do not physically delete the meal.
   We mark it as cancelled.
========================================================= */

async function cancelMeal(req, res, next) {

    try {

        const mealId = mealIdFromRequest(req);


        if (!mealId) {

            return res.status(400).json({

                success: false,

                message: "Invalid meal ID."

            });
        }


        // Staff may only cancel meals that belong to their own hall.
        if (req.user?.role === "staff") {
            const [mealRows] = await db.query(
                "SELECT hall_name FROM meals WHERE id = ? LIMIT 1",
                [mealId]
            );
            const existingMeal = mealRows[0];

            if (!existingMeal) {
                return res.status(404).json({
                    success: false,
                    message: "Meal not found or already cancelled."
                });
            }

            const staffHall = await getUserHallName(req.user.sub);

            if (!validHall(staffHall) || normalizeHallName(existingMeal.hall_name) !== staffHall) {
                return res.status(403).json({
                    success: false,
                    message: "You can only manage meals for your own hall."
                });
            }
        }

        const [result] = await db.query(`
            UPDATE meals
            SET status = 'cancelled'
            WHERE id = ?
            AND status != 'cancelled'
        `, [mealId]);


        if (result.affectedRows === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Meal not found or already cancelled."

            });
        }


        return res.status(200).json({

            success: true,

            message:
                "Meal cancelled successfully."

        });

    } catch (error) {

        return next(error);

    }
}


/* =========================================================
   EXPORT CONTROLLERS
========================================================= */

module.exports = {

    getMeals,

    getTodaysMeals,

    getMealById,

    createMeal,

    updateMeal,

    cancelMeal

};
