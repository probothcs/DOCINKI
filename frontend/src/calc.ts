export type Opening = { x: number; y: number; width: number; height: number };
// how the wall top is finished: exact courses, low brick, half block 50×12, or a course cut in height
export type TopKind = "exact" | "brick" | "half" | "cut";

export type WallInput = {
  name: string;
  length: number;
  height: number;
  thickness: number;
  openings: Opening[];
  topVariant?: string; // chosen variant key, empty = auto (fewest cuts)
  kimlaga?: boolean; // first course from waterproof kimlaga block
  allowBrick?: boolean; // may the top be finished with a low brick (9/14/19)
};

export type Settings = {
  blockLength: number; // nominal, cm
  blockHeight: number; // regular brick height, e.g. 24
  mortar: number; // bed joint, e.g. 1
  minModule: number; // smallest course height from the table, e.g. 24.4
  maxModule: number; // largest course height from the table, e.g. 25.1
  topBricks: number[]; // special low bricks for the top course, e.g. 9, 14, 19
  topBrickLength: number; // length of the low finishing brick, e.g. 30
  defaultKimlaga: boolean; // new walls start with a kimlaga course
  defaultAllowBrick: boolean; // new walls may get a low brick on top
  kimlagaHeight: number; // whole first kimlaga course incl. joint, e.g. 21
  // saved height tables (course tops from the sheet); a table starting with the kimlaga height is for kimlaga walls
  heightTables: number[][];
  topSpare: number; // spare finishing bricks per wall, e.g. 1
  tolerance100: number; // real length of 100 cm of blocks, e.g. 98
  luz: number; // slack subtracted from every cut, cm
  minPiece: number; // smallest acceptable piece, cm
  gapMax: number; // rest at the wall end up to this is filled with mortar instead of cut, e.g. 3
  firstCourseHalf: boolean; // kept for saved data, always false
};

export const DEFAULT_SETTINGS: Settings = {
  blockLength: 50,
  blockHeight: 24,
  mortar: 1,
  minModule: 24.4,
  maxModule: 25.1,
  topBricks: [9, 14, 19],
  topBrickLength: 30,
  defaultKimlaga: false,
  defaultAllowBrick: true,
  kimlagaHeight: 21,
  heightTables: [
    [21, 45.2, 69.9, 94.6, 119.3, 144, 168.7, 193.4, 218.1, 243, 268],
    [24.1, 48.6, 72.8, 96.9, 121, 145.2, 169.4, 193.5, 217.7, 241.8, 266],
  ],
  topSpare: 1,
  tolerance100: 100,
  luz: 1,
  minPiece: 10,
  gapMax: 3,
  firstCourseHalf: false,
};

// older saved settings used blockHeight = 25 as course height without mortar
export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  if (raw && raw.mortar === undefined && raw.blockHeight === 25) s.blockHeight = 24;
  return s;
}

export type Piece = {
  start: number;
  len: number;
  isCut: boolean;
  cutLen: number;
  h: number | null;
  from: number;
  brick?: boolean;
  kim?: boolean;
};
export type Course = {
  index: number; // 1 = bottom
  bottom: number;
  height: number;
  brickHeight: number;
  isTop: boolean;
  isKim?: boolean;
  startsHalf: boolean;
  segments: Piece[][];
  full: number;
  cuts: Piece[];
};
export type CutGroup = { len: number; h: number | null; from: number; count: number; kim?: boolean };
export type Variant = { key: string; kind: TopKind; t: number; label: string; cuts: number; lay: number };
export type CalcResult = {
  module: number;
  courseCount: number;
  courseHeight: number;
  stackHeight: number;
  layHeight: number; // height to build the table courses to (kimlaga + courses), e.g. 251
  fromTable?: boolean; // course tops taken from a saved height table
  topKind: TopKind;
  topBrick: number | null;
  topIsCut: boolean;
  halfTop?: boolean;
  outOfTable?: boolean;
  kimlaga: number | null; // kimlaga course height, null = none
  kimFull: number;
  kimCuts: number;
  courses: Course[];
  totalFull: number; // regular full blocks (without kimlaga)
  topFull: number;
  totalCuts: number;
  cutCount: number; // all cuts: pieces + halves (2 halves = 1 cut)
  cutGroups: CutGroup[];
  variant: string;
  bestVariant: string;
  variants: Variant[];
};

const EPS = 0.05;
const r1 = (n: number) => Math.round(n * 10) / 10;

export const fmt = (n: number) => r1(n).toLocaleString("pl-PL", { maximumFractionDigits: 1 });

export const cutsWord = (n: number) =>
  n === 1 ? "cięcie" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "cięcia" : "cięć";

type HeightPlan = { key: string; kind: TopKind; n: number; m: number; t: number; marks?: number[] };

// course tops from a saved height table that ends exactly at the lay height (e.g. kimlaga 21 … 268)
function tableFit(lay: number, s: Settings, K0: number): { n: number; m: number; marks: number[] } | null {
  for (const tb of s.heightTables ?? []) {
    if (tb.length < 2 || Math.abs(tb[tb.length - 1] - lay) > 0.3) continue;
    const kimTable = Math.abs(tb[0] - s.kimlagaHeight) < 0.05;
    if (kimTable !== K0 > 0) continue;
    const marks = (kimTable ? tb.slice(1) : tb).map((v) => v);
    marks[marks.length - 1] = lay;
    return { n: marks.length, m: (lay - K0) / marks.length, marks };
  }
  return null;
}

// course count n and course height m from the table range (e.g. 24.4–25.1), closest to the nominal course
function fitCourses(target: number, s: Settings): { n: number; m: number } | null {
  if (target <= 0) return null;
  const nominal = s.blockHeight + s.mortar;
  let best: { n: number; m: number; score: number } | null = null;
  for (let n = 1; n <= Math.ceil(target / Math.max(s.minModule, 1)); n++) {
    const m = r1(target / n);
    if (m < s.minModule - 1e-9 || m > s.maxModule + 1e-9) continue;
    const err = Math.abs(n * m - target);
    if (err > 0.5) continue;
    const score = Math.abs(m - nominal) + err * 2;
    if (!best || score < best.score) best = { n, m, score };
  }
  return best;
}

// every way to finish the wall height: exact, brick 9/14/19, half 12, top course cut in height
function planVariants(H: number, s: Settings, K0: number, allowBrick: boolean): HeightPlan[] {
  const out: HeightPlan[] = [];
  const base = H - K0;
  const nominal = s.blockHeight + s.mortar;
  const fit = (target: number) => tableFit(K0 + target, s, K0) ?? fitCourses(target, s);
  const ex = fit(base);
  if (ex) out.push({ key: "exact", kind: "exact", ...ex, t: 0 });
  (allowBrick ? [...s.topBricks] : []).sort((a, z) => a - z).forEach((t) => {
    const f = fit(base - t - s.mortar);
    if (f) out.push({ key: `brick:${t}`, kind: "brick", ...f, t });
  });
  const half = s.blockHeight / 2;
  const ht = base - half - s.mortar;
  if (ht > 0) {
    const tf = tableFit(K0 + ht, s, K0);
    const n = Math.max(1, Math.round(ht / nominal));
    out.push(tf ? { key: "half", kind: "half", ...tf, t: half } : { key: "half", kind: "half", n, m: ht / n, t: half });
  }
  for (let n = 1; n * nominal < base; n++) {
    const rest = Math.floor(base - n * nominal - s.mortar + 0.05);
    if (rest >= 3 && rest <= s.blockHeight - 1) out.push({ key: `cut:${rest}`, kind: "cut", n, m: nominal, t: rest });
  }
  if (!out.length) {
    const n = Math.max(1, Math.round(base / nominal));
    out.push({ key: "exact", kind: "exact", n, m: Math.max(base, 1) / n, t: 0 });
  }
  return out;
}

const variantLabel = (p: HeightPlan) =>
  p.kind === "exact" ? "Na wymiar" : p.kind === "brick" ? `Cegła ${fmt(p.t)}` : p.kind === "half" ? `Połówka ${fmt(p.t)}` : `Cięta ${fmt(p.t)}`;

function segmentPieces(
  s: number,
  e: number,
  offset: number,
  b: number,
  s0: Settings,
  h: number | null,
  from: number,
  topCutH: number | null,
  L: number,
  cutFrom: number,
): Piece[] {
  const cuts: number[] = [];
  let k = Math.ceil((s - offset) / b - 1e-9);
  for (let p = offset + k * b; p < e - EPS; k++, p = offset + k * b) {
    if (p > s + EPS) cuts.push(p);
  }
  // a height-cut piece under a notch that fits in one block is not split by the bond joint
  const bounds = h !== null && e - s <= s0.blockLength + EPS ? [s, e] : [s, ...cuts, e];
  let lens = bounds.slice(1).map((v, i) => v - bounds[i]);

  // a rest up to gapMax (e.g. 3 cm) at the wall end is not cut: gap filled with mortar
  // between the last and second-to-last block
  let gap = 0;
  if (lens.length >= 2 && Math.abs(e - L) < EPS && lens[lens.length - 1] <= s0.gapMax + EPS) {
    gap = lens.pop() as number;
  }

  // Avoid tiny pieces only at the wall ends: merge with neighbour and split in half
  if (!gap && lens.length >= 2 && Math.abs(e - L) < EPS && lens[lens.length - 1] < s0.minPiece) {
    const t = lens[lens.length - 1] + lens[lens.length - 2];
    lens.splice(lens.length - 2, 2, t / 2, t / 2);
  }
  if (lens.length >= 2 && s < EPS && lens[0] < s0.minPiece) {
    const t = lens[0] + lens[1];
    lens.splice(0, 2, t / 2, t / 2);
  }

  const half = s0.blockLength / 2;
  let pos = s;
  return lens.map((len, idx) => {
    if (gap && idx === lens.length - 1) pos += gap;
    const shortLen = len < b - EPS;
    // in the top course every cut is taken from the big block, cut to the top brick height
    const ph = h ?? (shortLen ? topCutH : null);
    const isCut = shortLen || ph !== null;
    // the starting half block at the wall edge is always a fixed half (e.g. 25), no luz
    const isStartHalf = shortLen && pos < EPS && offset > 0 && Math.abs(len - half) < EPS;
    // height-cut pieces under notches keep the exact drawing length;
    // length cuts: minus luz, rounded DOWN to a whole cm (better 1 cm less than more)
    const cutLen = !isCut
      ? 0
      : isStartHalf
        ? r1(half)
        : h !== null
          ? r1(len)
          : Math.max(Math.floor(len - s0.luz + 0.05), 0);
    // every cut comes from the big block (or from the half block on a block-finished top)
    const piece: Piece = { start: pos, len: r1(len), isCut, cutLen, h: ph, from: isCut ? (h !== null ? s0.blockHeight : cutFrom) : from };
    pos += len;
    return piece;
  });
}

type Row = { bottom: number; top: number; brickH: number; isTop: boolean; isKim?: boolean };
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
    const h = !partial || avail >= row.brickH - EPS ? rowCutH : Math.floor(Math.min(avail, rowCutH ?? Infinity) + 0.05);
    const last = runs[runs.length - 1];
    if (last && Math.abs(last.e - a) < EPS && last.h === h) last.e = z;
    else runs.push({ s: a, e: z, h });
  }
  return runs;
}

type Built = Omit<CalcResult, "variant" | "bestVariant" | "variants">;

function build(w: WallInput, s: Settings, plan: HeightPlan, K0: number): Built {
  const b = (s.blockLength * s.tolerance100) / 100;
  const topIsCut = plan.kind === "cut";
  const halfTop = plan.kind === "half";

  const rows: Row[] = [];
  if (K0 > 0) rows.push({ bottom: 0, top: K0, brickH: K0 - s.mortar, isTop: false, isKim: true });
  const tops = plan.marks ?? Array.from({ length: plan.n }, (_, i) => K0 + (i + 1) * plan.m);
  tops.forEach((top, i) => rows.push({ bottom: i ? tops[i - 1] : K0, top, brickH: s.blockHeight, isTop: false }));
  const lay = tops.length ? tops[tops.length - 1] : K0;
  if (plan.t > 0) rows.push({ bottom: lay, top: w.height, brickH: plan.t, isTop: true });

  const courses: Course[] = rows.map((row, i) => {
    // bond starts above the kimlaga: first block course from a full block, next from a half (e.g. 25)
    const bondIdx = K0 > 0 ? i - 1 : i;
    const startsHalf = !row.isKim && bondIdx % 2 === 1;
    const offset = startsHalf ? s.blockLength / 2 : 0;
    const rowCutH = row.isTop && topIsCut ? plan.t : null;
    const from = row.isKim ? K0 : row.isTop && !topIsCut ? plan.t : s.blockHeight;
    const runs = rowRuns(w, row, s, rowCutH);
    const brickTop = row.isTop && plan.kind === "brick";
    // block-finished top: full pieces are halves 50×12, shorter ones are cut from a half
    const halfRow = row.isTop && halfTop;
    // top finishing course: low bricks (e.g. 30×14) fitted on site, no length cuts;
    // only pieces of a different height (under notches) are cut from the big block
    const segments = brickTop
      ? runs.map((r) =>
          r.h === null
            ? [{ start: r.s, len: r1(r.e - r.s), isCut: false, cutLen: 0, h: null, from: plan.t, brick: true } as Piece]
            : segmentPieces(r.s, r.e, offset, b, s, r.h, s.blockHeight, null, w.length, s.blockHeight),
        )
      : runs.map((r) =>
          segmentPieces(r.s, r.e, offset, b, s, r.h, from, row.isTop && !halfTop ? row.brickH : null, w.length, halfRow ? plan.t : s.blockHeight),
        );
    // kimlaga course: drawn but never counted as cuts (pieces fitted on site)
    if (row.isKim) segments.flat().forEach((p) => Object.assign(p, { from: K0, kim: true, isCut: false, cutLen: 0 }));
    const all = segments.flat();
    const brickLen = runs.filter((r) => r.h === null).reduce((n, r) => n + (r.e - r.s), 0);
    const bricks = brickTop && brickLen > 0 ? Math.round(brickLen / (s.topBrickLength + s.mortar)) + s.topSpare : 0;
    return {
      index: i + 1,
      bottom: r1(row.bottom),
      height: r1(row.top - row.bottom),
      brickHeight: row.brickH,
      isTop: row.isTop,
      isKim: !!row.isKim,
      startsHalf,
      segments,
      full: brickTop ? bricks : all.filter((p) => !p.isCut).length,
      cuts: all.filter((p) => p.isCut),
    };
  });

  const map = new Map<string, CutGroup>();
  courses.forEach((c) =>
    c.cuts.forEach((p) => {
      const key = pieceKey(p);
      const g = map.get(key);
      if (g) g.count++;
      else map.set(key, { len: p.cutLen, h: p.h, from: p.from, count: 1, kim: !!p.kim });
    }),
  );
  const cutGroups = sortGroups([...map.values()]);
  const topFull = courses.filter((c) => c.isTop).reduce((n, c) => n + c.full, 0);
  const totalCuts = courses.reduce((n, c) => n + c.cuts.length, 0);
  const kim = courses.find((c) => c.isKim);

  return {
    module: r1(b),
    courseCount: plan.n,
    courseHeight: plan.m,
    stackHeight: r1(lay - K0),
    layHeight: r1(lay),
    fromTable: !!plan.marks,
    topKind: plan.kind,
    topBrick: plan.t > 0 ? plan.t : null,
    topIsCut,
    halfTop,
    outOfTable: !plan.marks && (plan.m < s.minModule - 0.05 || plan.m > s.maxModule + 0.05),
    kimlaga: K0 > 0 ? K0 : null,
    kimFull: kim?.full ?? 0,
    kimCuts: kim?.cuts.length ?? 0,
    courses,
    totalFull: courses.filter((c) => !c.isTop && !c.isKim).reduce((n, c) => n + c.full, 0),
    topFull,
    totalCuts,
    cutCount: totalCuts + (halfTop ? Math.ceil(topFull / 2) : 0),
    cutGroups,
  };
}

const KIND_ORDER: Record<TopKind, number> = { exact: 0, brick: 1, half: 2, cut: 3 };

// Calculates every top variant, picks the one with the fewest cuts (ties: exact, brick, half, cut)
// unless the wall has a manually chosen variant that is still possible.
export function calculate(w: WallInput, settings: Settings): CalcResult {
  const s = normalizeSettings(settings);
  const K0 = (w.kimlaga ?? s.defaultKimlaga) ? s.kimlagaHeight : 0;
  const all = planVariants(w.height, s, K0, w.allowBrick ?? s.defaultAllowBrick).map((p) => ({ p, r: build(w, s, p, K0) }));
  all.sort((a, z) => a.r.cutCount - z.r.cutCount || KIND_ORDER[a.p.kind] - KIND_ORDER[z.p.kind] || a.p.t - z.p.t);
  const best = all[0];
  const chosen = all.find((x) => x.p.key === w.topVariant) ?? best;
  return {
    ...chosen.r,
    variant: chosen.p.key,
    bestVariant: best.p.key,
    variants: all.map(({ p, r }) => ({ key: p.key, kind: p.kind, t: p.t, label: variantLabel(p), cuts: r.cutCount, lay: r.layHeight })),
  };
}

const sortGroups = (gs: CutGroup[]) =>
  gs.sort((a, z) => Number(!!z.kim) - Number(!!a.kim) || (a.h ?? 999) - (z.h ?? 999) || z.len - a.len);

export const groupKey = (g: CutGroup) => `${g.len}|${g.h}|${g.from}|${g.kim ? "k" : ""}`;
export const pieceKey = (p: Piece) => `${p.cutLen}|${p.h}|${p.from}|${p.kim ? "k" : ""}`;
export const courseName = (c: Course) => (c.isTop ? "GÓRA" : c.isKim ? "KIM" : `W${c.index}`);

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
      const key = groupKey(g);
      const cur = map.get(key);
      if (cur) cur.count += g.count;
      else map.set(key, { ...g });
    }),
  );
  return sortGroups([...map.values()]);
}

export const cutLabel = (p: { len?: number; cutLen?: number; h: number | null }) => {
  const l = fmt(p.cutLen ?? p.len ?? 0);
  return p.h !== null ? `${l}×${fmt(p.h)}` : l;
};
