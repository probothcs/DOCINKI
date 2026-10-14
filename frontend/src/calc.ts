export type Opening = { x: number; y: number; width: number; height: number };

export type WallInput = {
  name: string;
  length: number;
  height: number;
  thickness: number;
  openings: Opening[];
};

export type Settings = {
  blockLength: number; // nominal, cm
  blockHeight: number; // regular brick height, e.g. 24
  mortar: number; // bed joint, e.g. 1
  minModule: number; // smallest course height from the table, e.g. 24.4
  maxModule: number; // largest course height from the table, e.g. 25.1
  topBricks: number[]; // special low bricks for the top course, e.g. 9, 14, 19
  tolerance100: number; // real length of 100 cm of blocks, e.g. 98
  luz: number; // slack subtracted from every cut, cm
  minPiece: number; // smallest acceptable piece, cm
  firstCourseHalf: boolean; // kept for saved data, always false
};

export const DEFAULT_SETTINGS: Settings = {
  blockLength: 50,
  blockHeight: 24,
  mortar: 1,
  minModule: 24.4,
  maxModule: 25.1,
  topBricks: [9, 14, 19],
  tolerance100: 100,
  luz: 1,
  minPiece: 10,
  firstCourseHalf: false,
};

// older saved settings used blockHeight = 25 as course height without mortar
export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  if (raw && raw.mortar === undefined && raw.blockHeight === 25) s.blockHeight = 24;
  return s;
}

export type Piece = { start: number; len: number; isCut: boolean; cutLen: number; h: number | null; from: number };
export type Course = {
  index: number; // 1 = bottom
  bottom: number;
  height: number;
  brickHeight: number;
  isTop: boolean;
  startsHalf: boolean;
  segments: Piece[][];
  full: number;
  cuts: Piece[];
};
export type CutGroup = { len: number; h: number | null; from: number; count: number };
export type CalcResult = {
  module: number;
  courseCount: number;
  courseHeight: number;
  stackHeight: number;
  topBrick: number | null;
  topIsCut: boolean;
  heightWarning: boolean;
  courses: Course[];
  totalFull: number;
  topFull: number;
  totalCuts: number;
  cutGroups: CutGroup[];
};

const EPS = 0.05;
const r1 = (n: number) => Math.round(n * 10) / 10;

export const fmt = (n: number) => r1(n).toLocaleString("pl-PL", { maximumFractionDigits: 1 });

type HeightPlan = { n: number; m: number; t: number; topIsCut: boolean; warning: boolean };

// Pick course count n and course height m from the table range (e.g. 24.4–25.1),
// optionally topped with a low brick (9/14/19 + mortar), closest to the nominal course.
function planHeight(H: number, s: Settings): HeightPlan {
  const nominal = s.blockHeight + s.mortar;
  let best: (HeightPlan & { score: number }) | null = null;
  for (let n = 1; n <= Math.ceil(H / Math.max(s.minModule, 1)); n++) {
    for (const t of [0, ...s.topBricks]) {
      const target = H - (t ? t + s.mortar : 0);
      if (target <= 0) continue;
      const m = r1(target / n);
      if (m < s.minModule - 1e-9 || m > s.maxModule + 1e-9) continue;
      const err = Math.abs(n * m - target);
      if (err > 0.5) continue;
      const score = Math.abs(m - nominal) + err * 2 + (t ? 0.001 : 0);
      if (!best || score < best.score) best = { n, m, t, topIsCut: false, warning: false, score };
    }
  }
  if (best) return best;
  // fallback: nominal courses + top cut in height from a regular brick
  const n = Math.max(1, Math.floor(H / nominal));
  const rest = r1(H - n * nominal - s.mortar);
  return { n, m: nominal, t: rest > 1 ? rest : 0, topIsCut: rest > 1, warning: true };
}

function segmentPieces(
  s: number,
  e: number,
  offset: number,
  b: number,
  s0: Settings,
  h: number | null,
  from: number,
  topCutH: number | null,
): Piece[] {
  const cuts: number[] = [];
  let k = Math.ceil((s - offset) / b - 1e-9);
  for (let p = offset + k * b; p < e - EPS; k++, p = offset + k * b) {
    if (p > s + EPS) cuts.push(p);
  }
  const bounds = [s, ...cuts, e];
  let lens = bounds.slice(1).map((v, i) => v - bounds[i]);

  // Avoid tiny pieces at segment ends: merge with neighbour and split in half
  if (lens.length >= 2 && lens[lens.length - 1] < s0.minPiece) {
    const t = lens[lens.length - 1] + lens[lens.length - 2];
    lens.splice(lens.length - 2, 2, t / 2, t / 2);
  }
  if (lens.length >= 2 && lens[0] < s0.minPiece) {
    const t = lens[0] + lens[1];
    lens.splice(0, 2, t / 2, t / 2);
  }

  const half = s0.blockLength / 2;
  let pos = s;
  return lens.map((len) => {
    const shortLen = len < b - EPS;
    // in the top course every cut is taken from the big block, cut to the top brick height
    const ph = h ?? (shortLen ? topCutH : null);
    const isCut = shortLen || ph !== null;
    // the starting half block at the wall edge is always a fixed half (e.g. 25), no luz
    const isStartHalf = shortLen && pos < EPS && offset > 0 && Math.abs(len - half) < EPS;
    // height-cut pieces under notches keep the exact drawing length
    const cutLen = !isCut ? 0 : isStartHalf ? r1(half) : h !== null ? r1(len) : r1(Math.max(len - s0.luz, 0));
    // every cut comes from the big block (e.g. 50×24); only full top pieces are the low finishing brick
    const piece: Piece = { start: pos, len: r1(len), isCut, cutLen, h: ph, from: isCut ? s0.blockHeight : from };
    pos += len;
    return piece;
  });
}

type Row = { bottom: number; top: number; brickH: number; isTop: boolean };
type Run = { s: number; e: number; h: number | null };

function rowRuns(w: WallInput, row: Row, s: Settings, rowCutH: number | null): Run[] {
  const rel = w.openings.filter((o) => Math.min(row.top, o.y + o.height) - Math.max(row.bottom, o.y) > 0.5);
  const xs = [...new Set([0, w.length, ...rel.flatMap((o) => [o.x, o.x + o.width])])]
    .filter((x) => x >= 0 && x <= w.length)
    .sort((a, z) => a - z);
  const runs: Run[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const z = xs[i + 1];
    if (z - a <= EPS) continue;
    const mid = (a + z) / 2;
    let lo = row.bottom;
    let hi = row.top;
    let partial = false;
    for (const o of rel) {
      if (!(o.x < mid && mid < o.x + o.width)) continue;
      const oTop = o.y + o.height;
      partial = true;
      if (o.y <= lo + EPS && oTop >= hi - EPS) {
        lo = hi;
        break;
      }
      if (oTop >= hi - EPS) hi = Math.min(hi, o.y);
      else if (o.y <= lo + EPS) lo = Math.max(lo, oTop);
      else if (o.y - lo >= hi - oTop) hi = o.y;
      else lo = oTop;
    }
    const avail = hi - lo - s.mortar;
    if (lo >= hi || avail < 1.5) continue;
    const h = !partial || avail >= row.brickH - EPS ? rowCutH : r1(Math.min(avail, rowCutH ?? Infinity));
    const last = runs[runs.length - 1];
    if (last && Math.abs(last.e - a) < EPS && last.h === h) last.e = z;
    else runs.push({ s: a, e: z, h });
  }
  return runs;
}

export function calculate(w: WallInput, settings: Settings): CalcResult {
  const s = normalizeSettings(settings);
  const b = (s.blockLength * s.tolerance100) / 100;
  const plan = planHeight(w.height, s);

  const rows: Row[] = [];
  for (let i = 0; i < plan.n; i++) rows.push({ bottom: i * plan.m, top: (i + 1) * plan.m, brickH: s.blockHeight, isTop: false });
  if (plan.t > 0) rows.push({ bottom: plan.n * plan.m, top: w.height, brickH: plan.t, isTop: true });

  const courses: Course[] = rows.map((row, i) => {
    // bottom course starts with a full block, every second course starts with a half (blockLength / 2, e.g. 25)
    const startsHalf = i % 2 === 1;
    const offset = startsHalf ? s.blockLength / 2 : 0;
    const rowCutH = row.isTop && plan.topIsCut ? plan.t : null;
    const from = row.isTop && !plan.topIsCut ? plan.t : s.blockHeight;
    const topCutH = row.isTop ? row.brickH : null;
    const segments = rowRuns(w, row, s, rowCutH).map((r) => segmentPieces(r.s, r.e, offset, b, s, r.h, from, topCutH));
    const all = segments.flat();
    return {
      index: i + 1,
      bottom: r1(row.bottom),
      height: r1(row.top - row.bottom),
      brickHeight: row.brickH,
      isTop: row.isTop,
      startsHalf,
      segments,
      full: all.filter((p) => !p.isCut).length,
      cuts: all.filter((p) => p.isCut),
    };
  });

  const map = new Map<string, CutGroup>();
  courses.forEach((c) =>
    c.cuts.forEach((p) => {
      const key = `${p.cutLen}|${p.h}|${p.from}`;
      const g = map.get(key);
      if (g) g.count++;
      else map.set(key, { len: p.cutLen, h: p.h, from: p.from, count: 1 });
    }),
  );
  const cutGroups = [...map.values()].sort((a, z) => (a.h ?? 999) - (z.h ?? 999) || z.len - a.len);

  return {
    module: r1(b),
    courseCount: plan.n,
    courseHeight: plan.m,
    stackHeight: r1(plan.n * plan.m),
    topBrick: plan.t > 0 ? plan.t : null,
    topIsCut: plan.topIsCut,
    heightWarning: plan.warning,
    courses,
    totalFull: courses.filter((c) => !c.isTop).reduce((n, c) => n + c.full, 0),
    topFull: courses.filter((c) => c.isTop).reduce((n, c) => n + c.full, 0),
    totalCuts: courses.reduce((n, c) => n + c.cuts.length, 0),
    cutGroups,
  };
}

export const groupKey = (g: CutGroup) => `${g.len}|${g.h}|${g.from}`;
export const pieceKey = (p: Piece) => `${p.cutLen}|${p.h}|${p.from}`;
export const courseName = (c: Course) => (c.isTop ? "GÓRA" : `W${c.index}`);

// where each cut type sits: group key -> list of courses
export function cutLocations(r: CalcResult): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  r.courses.forEach((c) =>
    c.cuts.forEach((p) => {
      const k = pieceKey(p);
      const list = (m[k] ??= []);
      const n = courseName(c);
      if (!list.includes(n)) list.push(n);
    }),
  );
  return m;
}

export function mergeGroups(results: CalcResult[]): CutGroup[] {
  const map = new Map<string, CutGroup>();
  results.forEach((r) =>
    r.cutGroups.forEach((g) => {
      const key = `${g.len}|${g.h}|${g.from}`;
      const cur = map.get(key);
      if (cur) cur.count += g.count;
      else map.set(key, { ...g });
    }),
  );
  return [...map.values()].sort((a, z) => (a.h ?? 999) - (z.h ?? 999) || z.len - a.len);
}

export const cutLabel = (p: { len?: number; cutLen?: number; h: number | null }) => {
  const l = fmt(p.cutLen ?? p.len ?? 0);
  return p.h !== null ? `${l}×${fmt(p.h)}` : l;
};
