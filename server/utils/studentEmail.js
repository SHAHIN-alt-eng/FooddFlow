"use strict";

const STUDENT_REGISTRATION_EMAIL_PATTERN = /^[0-9]+@student\.ruet\.ac\.bd$/i;
const RUET_EMAIL_PATTERN = /^[^\s@]+@([a-z0-9-]+\.)*ruet\.ac\.bd$/i;

function isStudentRegistrationEmail(value) {
  return typeof value === "string" && STUDENT_REGISTRATION_EMAIL_PATTERN.test(value);
}

function isRuetEmail(value) {
  return typeof value === "string" && RUET_EMAIL_PATTERN.test(value);
}

module.exports = {
  isStudentRegistrationEmail,
  isRuetEmail
};
