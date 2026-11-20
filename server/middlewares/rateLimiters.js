"use strict";

const { rateLimit } = require("express-rate-limit");

function configuredLimit(variable, fallback) {
  const value = Number(process.env[variable]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function createWriteLimiter(variable, fallback) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: configuredLimit(variable, fallback),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please try again later."
    }
  });
}

module.exports = {
  registerLimiter: createWriteLimiter("REGISTER_RATE_LIMIT", 5),
  loginLimiter: createWriteLimiter("LOGIN_RATE_LIMIT", 10),
  mealWriteLimiter: createWriteLimiter("MEAL_WRITE_RATE_LIMIT", 60),
  reservationWriteLimiter: createWriteLimiter("RESERVATION_WRITE_RATE_LIMIT", 30)
};
