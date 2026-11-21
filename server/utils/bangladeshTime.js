"use strict";

const BANGLADESH_DATE_SQL = "DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 6 HOUR))";
const BANGLADESH_NOW_SQL = "DATE_ADD(UTC_TIMESTAMP(), INTERVAL 6 HOUR)";
const BANGLADESH_TOMORROW_SQL =
  `DATE_ADD(${BANGLADESH_DATE_SQL}, INTERVAL 1 DAY)`;

function getBangladeshDate(value = new Date()) {
  return new Date(value.getTime() + 6 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function getBangladeshTomorrowDate(value = new Date()) {
  const tomorrow = new Date(`${getBangladeshDate(value)}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function getMealReservationDeadline(mealDate) {
  const [year, month, day] = mealDate.split("-").map(Number);
  const previousDay = new Date(Date.UTC(year, month - 1, day - 1));

  return `${previousDay.toISOString().slice(0, 10)} 23:30:00`;
}

module.exports = {
  BANGLADESH_DATE_SQL,
  BANGLADESH_NOW_SQL,
  BANGLADESH_TOMORROW_SQL,
  getBangladeshDate,
  getBangladeshTomorrowDate,
  getMealReservationDeadline
};
