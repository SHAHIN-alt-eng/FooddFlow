"use strict";

const HALLS = [
  "Shaheed President Zia Hall",
  "Abdul Hamid Hall",
  "Tinshed Hall",
  "Shohidul Hall",
  "Shere-e-Bangla A K Fazlul Haque Hall",
  "Selim Hall",
  "Male Hall-1",
  "Male Hall-2",
  "Male Hall-3",
  "Female Hall 1",
  "Female Hall 2"
];

const HALLS_BY_GENDER = {
  male: HALLS.slice(0, -2),
  female: HALLS.slice(-2)
};

const HALL_NAMES = new Map(
  HALLS.map((hall) => [hall.toLowerCase(), hall])
);

[
  ["sohidul hall", "Shohidul Hall"],
  ["shahidul hall", "Shohidul Hall"],
  ["jia hall", "Shaheed President Zia Hall"],
  ["zia hall", "Shaheed President Zia Hall"],
  ["shaheed president jia hall", "Shaheed President Zia Hall"],
  ["shaheed president jiya hall", "Shaheed President Zia Hall"]
].forEach(([alias, canonical]) => HALL_NAMES.set(alias, canonical));

function normalizeHallName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  return HALL_NAMES.get(normalized) || "";
}

module.exports = {
  HALLS,
  HALLS_BY_GENDER,
  normalizeHallName
};
