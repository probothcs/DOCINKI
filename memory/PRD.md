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
- 2026-10: multi-wall batch (Dodaj ścianę on result, combined RAZEM summary, save all with project name); all cut pieces labelled in diagram (min scale + horizontal scroll); all cuts sourced from big block 50×24 (top-course cuts as len×14), only full top pieces are the low brick (tested iteration_3 all pass)
- 2026-10: height planning per course-height table (module 24,4–25,1, brick 24 + mortar 1), top course from low bricks 9/14/19 (e.g. 266 = 10×25,1 + 1 + 14); notches/partial openings produce length×height cuts (e.g. 17×7 from brick 9); new settings: mortar, min/max course, top bricks; AI prompt reads corner notches (tested iteration_2 all pass)

- 2026-10: unlimited walls per batch, tap cut type -> highlight on all diagrams + 'Gdzie' locations (per wall & RAZEM), saved wall -> 'Dodaj ścianę do projektu' reopens whole project (re-save replaces old records) (iteration_4 pass)

## Backlog
- P1: PDF/share of the cut list, mark courses as done on site
- P1: multiple walls per drawing sheet (front + returns)
- P2: block type presets (Ploegsteert sizes), top-course height cut option

## Update (June 2026) — automatyczna góra, kimlaga, tabele wysokości
- Automatyczny wybór wariantu góry (Na wymiar / Cegła 9/14/19 / Połówka 12 / Cięta X) z najmniejszą liczbą cięć, ręczna zmiana wariantu (chipy z liczbą cięć i "muruj na")
- Przełącznik "Kimlaga na dole" (21 cm, docinki "z kimlagi 50×21") i "Cegła na górę" przy ścianie + domyślne w Ustawieniach
- Zapisane tabele wysokości warstw (z kimlagą 21…268, bez kimlagi 24,1…266) — gdy koniec tabeli = wymiar muru, warstwy dokładnie z tabeli
- Box "MURUJ NA WYMIAR", rysunek z wymiarami (wysokość, długość, wycięcia), kolumna wysokości warstw
- AI rozpoznaje pasek KIM jako kimlagę (nie wycięcie) i ustawia wysokość w kierunku murowania; przycisk "Zamień długość ↔ wysokość"
- Testy: iteration_5 — wszystko PASS
## Backlog
- P1: Kartka dla pilarza (PDF/WhatsApp), odhaczanie warstw
- P2: Zapotrzebowanie materiału, więcej tabel wysokości
- (June 2026) Kimlaga nie liczy się do docinek ani do wiązania (1. warstwa nad kimlagą od pełnego). Reszta na końcu warstwy ≤ 3 cm (ustawienie "Reszta wypełniana zaprawą") = przerwa z zaprawą między ostatnim a przedostatnim bloczkiem, bez cięcia.
