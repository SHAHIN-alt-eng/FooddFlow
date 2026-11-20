"use strict";

const jwt = require("jsonwebtoken");
const { db } = require("../config/db");

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization?.trim();

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required."
    });
  }

  const parts = authHeader.split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== "bearer" ||
    !parts[1]
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid authorization format. Use Bearer <token>."
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing from environment variables.");

    return res.status(500).json({
      success: false,
      message: "Authentication configuration error."
    });
  }

  try {
    const decoded = jwt.verify(parts[1], process.env.JWT_SECRET);

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token."
      });
    }

    const [users] = await db.query(
      "SELECT id, role, status FROM users WHERE id = ? LIMIT 1",
      [decoded.sub]
    );
    const user = users[0];

    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Your account is not active. Please contact an administrator."
      });
    }

    req.user = {
      sub: user.id,
      role: user.role
    };

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again."
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed."
    });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource."
      });
    }

    return next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles
};
