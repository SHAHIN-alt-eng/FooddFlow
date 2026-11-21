"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getBangladeshDate,
  getBangladeshTomorrowDate,
  getMealReservationDeadline
} = require("../utils/bangladeshTime");

test("uses Bangladesh's calendar date around UTC midnight", () => {
  const now = new Date("2026-11-21T18:30:00.000Z");

  assert.equal(getBangladeshDate(now), "2026-11-22");
  assert.equal(getBangladeshTomorrowDate(now), "2026-11-23");
});

test("sets the reservation deadline to 11:30 PM on the previous Bangladesh date", () => {
  assert.equal(
    getMealReservationDeadline("2026-11-22"),
    "2026-11-21 23:30:00"
  );
});
