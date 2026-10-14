# Docinki Pro — PRD

## Problem
User (Polish, prefab clay-block wall builder) uploads a photo of the architect's wall drawing (FF Products "WAND CONTROLE" sheets, e.g. F1-14402 320×301×14) and the app immediately calculates block cuts (docinki) per course.

## User choices
- Block 50×25 cm default (editable), half-block bond, Gemini 3 Flash reads drawing, history of walls, manual edit of dims before calculating
- Tolerance (100 cm of blocks = e.g. 98 cm) and luz (gap 20 → cut 19 with luz 1)
- 2026-10: every second course ALWAYS starts with a half = blockLength/2 (25 cm), fixed, no luz

## Architecture
- Backend FastAPI: POST /api/analyze (Gemini gemini-3-flash-preview via emergentintegrations), /api/walls CRUD (Mongo)
- Frontend Expo Router: tabs Nowa / Historia / Ustawienia, stack screens /edit, /result
- Calculation client-side in src/calc.ts (module = blockLength*tol/100, courses = round(H/blockHeight), openings split segments, tiny end pieces < minPiece merged & halved, luz subtracted from cuts)
- Settings stored locally (src/utils/storage)

## Implemented
- 2026-10: MVP — AI drawing read, editable dims + openings, per-course cut list, wall diagram, cut summary, history, settings; tested (iteration_1 all pass)
- 2026-10: course 2,4,6… start from a fixed 25 cm half
- 2026-10: height planning per course-height table (module 24,4–25,1, brick 24 + mortar 1), top course from low bricks 9/14/19 (e.g. 266 = 10×25,1 + 1 + 14); notches/partial openings produce length×height cuts (e.g. 17×7 from brick 9); new settings: mortar, min/max course, top bricks; AI prompt reads corner notches (tested iteration_2 all pass)

## Backlog
- P1: PDF/share of the cut list, mark courses as done on site
- P1: multiple walls per drawing sheet (front + returns)
- P2: block type presets (Ploegsteert sizes), top-course height cut option
