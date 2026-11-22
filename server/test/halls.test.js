"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { HALLS_BY_GENDER, normalizeHallName } = require("../utils/halls");

test("provides only halls valid for each student's gender", () => {
  assert.ok(HALLS_BY_GENDER.male.includes("Shohidul Hall"));
  assert.ok(!HALLS_BY_GENDER.male.includes("Female Hall 1"));
  assert.deepEqual(HALLS_BY_GENDER.female, ["Female Hall 1", "Female Hall 2"]);
});

test("normalizes legacy spellings of Shohidul Hall", () => {
  assert.equal(normalizeHallName("Sohidul Hall"), "Shohidul Hall");
  assert.equal(normalizeHallName("  SHAHIDUL   HALL "), "Shohidul Hall");
});

test("normalizes short and legacy spellings of Zia Hall", () => {
  assert.equal(normalizeHallName("Jia Hall"), "Shaheed President Zia Hall");
  assert.equal(
    normalizeHallName("Shaheed President Jiya Hall"),
    "Shaheed President Zia Hall"
  );
});

test("rejects unrecognized hall names", () => {
  assert.equal(normalizeHallName("Unknown Hall"), "");
  assert.equal(normalizeHallName(null), "");
});
