import assert from "node:assert/strict";

import { readDrawingTokens, type OcrToken } from "./src/read-drawing.ts";

const sheet: OcrToken[] = [
  { text: "Elementnr", x: 760, y: 690, width: 90, height: 18 },
  { text: "A14309", x: 860, y: 688, width: 80, height: 20 },
  { text: "344", x: 420, y: 760, width: 36, height: 16 },
  { text: "266", x: 24, y: 380, width: 32, height: 16 },
  { text: "259", x: 30, y: 120, width: 32, height: 14 },
  { text: "15", x: 930, y: 240, width: 20, height: 14 },
  { text: "17", x: 80, y: 90, width: 16, height: 12 },
  { text: "7", x: 110, y: 90, width: 12, height: 12 },
  { text: "1199.0", x: 200, y: 40, width: 54, height: 14 },
  { text: "BR12345", x: 700, y: 640, width: 70, height: 14 },
];

const a14309 = readDrawingTokens(sheet, 1000, 800);
assert.equal(a14309.name, "A14309");
assert.equal(a14309.length, 344);
assert.equal(a14309.height, 266);
assert.equal(a14309.thickness, 15);

const kimlaga = readDrawingTokens(
  [
    { text: "F1-14402", x: 700, y: 40, width: 90, height: 18 },
    { text: "205", x: 300, y: 20, width: 30, height: 14 },
    { text: "268", x: 12, y: 300, width: 30, height: 16 },
    { text: "14", x: 900, y: 300, width: 18, height: 14 },
    { text: "21", x: 200, y: 500, width: 18, height: 14 },
    { text: "1500.0", x: 100, y: 700, width: 50, height: 14 },
  ],
  1000,
  800,
);
assert.equal(kimlaga.name, "F1-14402");
assert.equal(kimlaga.length, 205);
assert.equal(kimlaga.height, 268);
assert.equal(kimlaga.thickness, 14);

const phone = readDrawingTokens(
  [
    { text: "266", x: 20, y: 300, width: 30, height: 16 },
    { text: "344", x: 400, y: 760, width: 36, height: 16 },
    { text: "011", x: 430, y: 700, width: 24, height: 12 },
    { text: "461", x: 470, y: 700, width: 24, height: 12 },
    { text: "3670", x: 510, y: 698, width: 36, height: 12 },
  ],
  1000,
  800,
);
assert.equal(phone.length, 344);
assert.equal(phone.height, 266);

const noPlace = readDrawingTokens([], 0, 0);
assert.equal(noPlace.length, null);
assert.equal(noPlace.height, null);
assert.equal(noPlace.notes.includes("Wysokości nie widzę"), true);

console.log("read-drawing tests passed");
