"use strict";
const router = require("express").Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const { registerUser, loginUser, getCurrentUser } = require("../controllers/authController");
const { registerLimiter, loginLimiter } = require("../middlewares/rateLimiters");
router.post("/register", registerLimiter, registerUser);
router.post("/login", loginLimiter, loginUser);
router.get("/profile", authenticateToken, getCurrentUser);
module.exports = router;
