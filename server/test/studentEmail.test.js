"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isRuetEmail,
  isStudentRegistrationEmail
} = require("../utils/studentEmail");

test("accepts student ID emails for new registrations", () => {
  assert.equal(isStudentRegistrationEmail("2103001@student.ruet.ac.bd"), true);
  assert.equal(isStudentRegistrationEmail("2103001@STUDENT.RUET.AC.BD"), true);
});

test("rejects non-student-ID or non-student RUET email formats at registration", () => {
  assert.equal(isStudentRegistrationEmail("someone@student.ruet.ac.bd"), false);
  assert.equal(isStudentRegistrationEmail("2103001@ruet.ac.bd"), false);
  assert.equal(isStudentRegistrationEmail("2103001@mail.ruet.ac.bd"), false);
  assert.equal(isStudentRegistrationEmail("21A3001@student.ruet.ac.bd"), false);
});

test("continues accepting existing RUET addresses for sign-in", () => {
  assert.equal(isRuetEmail("someone@student.ruet.ac.bd"), true);
  assert.equal(isRuetEmail("2103001@ruet.ac.bd"), true);
  assert.equal(isRuetEmail("someone@example.com"), false);
});
