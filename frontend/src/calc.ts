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
  blockHeight: number; // nominal, cm
  tolerance100: number; // real length of 100 cm of blocks, e.g. 98
  luz: number; // slack subtracted from every cut, cm
  minPiece: number; // smallest acceptable piece, cm
  firstCourseHalf: boolean; // first (bottom) course starts with a half block
};

export const DEFAULT_SETTINGS: Settings = {
  blockLength: 50,
  blockHeight: 25,
  tolerance100: 100,
  luz: 1,
  minPiece: 10,
  firstCourseHalf: false,
};

export type Piece = { start: number; len: number; isCut: boolean; cutLen: number };
export type Course = {
  index: number; // 1 = bottom
  bottom: number;
  startsHalf: boolean;
  segments: Piece[][];
  full: number;
  cuts: number[];
};
export type CutGroup = { len: number; count: number };
export type CalcResult = {
  module: number;
  courseCount: number;
  courseHeight: number;
  heightWarning: boolean;
  courses: Course[];
  totalFull: number;
  totalCuts: number;
  cutGroups: CutGroup[];
};

const EPS = 0.05;
const r1 = (n: number) => Math.round(n * 10) / 10;

export const fmt = (n: number) => r1(n).toLocaleString("pl-PL", { maximumFractionDigits: 1 });

function segmentPieces(s: number, e: number, offset: number, b: number, s0: Settings): Piece[] {
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
    const isCut = len < b - EPS;
    // the starting half block at the wall edge is always a fixed half (e.g. 25), no luz
    const isStartHalf = isCut && pos < EPS && offset > 0 && Math.abs(len - half) < EPS;
    const cutLen = isStartHalf ? r1(half) : isCut ? r1(Math.max(len - s0.luz, 0)) : 0;
    const piece = { start: pos, len: r1(len), isCut, cutLen };
    pos += len;
    return piece;
  });
}

export function calculate(w: WallInput, s: Settings): CalcResult {
  const b = (s.blockLength * s.tolerance100) / 100;
  const courseCount = Math.max(1, Math.round(w.height / s.blockHeight));
  const courseHeight = w.height / courseCount;
  const heightWarning = Math.abs(courseHeight - s.blockHeight) / s.blockHeight > 0.025;

  const courses: Course[] = [];
  for (let i = 0; i < courseCount; i++) {
    const bottom = i * courseHeight;
    const top = bottom + courseHeight;
    // bottom course starts with a full block, every second course starts with a half (blockLength / 2, e.g. 25)
    const startsHalf = i % 2 === 1;
    const offset = startsHalf ? s.blockLength / 2 : 0;

    // free horizontal intervals after removing openings that cross this course
    let free: [number, number][] = [[0, w.length]];
    for (const o of w.openings) {
      const overlap = Math.min(top, o.y + o.height) - Math.max(bottom, o.y);
      if (overlap <= 1) continue;
      const a = o.x;
      const z = o.x + o.width;
      free = free.flatMap(([fs, fe]) => {
        if (z <= fs || a >= fe) return [[fs, fe] as [number, number]];
        const out: [number, number][] = [];
        if (a > fs) out.push([fs, a]);
        if (z < fe) out.push([z, fe]);
        return out;
      });
    }
    const segments = free.filter(([fs, fe]) => fe - fs > EPS).map(([fs, fe]) => segmentPieces(fs, fe, offset, b, s));
    const all = segments.flat();
    courses.push({
      index: i + 1,
      bottom: r1(bottom),
      startsHalf,
      segments,
      full: all.filter((p) => !p.isCut).length,
      cuts: all.filter((p) => p.isCut).map((p) => p.cutLen),
    });
  }

  const map = new Map<number, number>();
  courses.forEach((c) => c.cuts.forEach((l) => map.set(l, (map.get(l) ?? 0) + 1)));
  const cutGroups = [...map.entries()].map(([len, count]) => ({ len, count })).sort((a, z) => z.len - a.len);

  return {
    module: r1(b),
    courseCount,
    courseHeight: Math.round(courseHeight * 100) / 100,
    heightWarning,
    courses,
    totalFull: courses.reduce((n, c) => n + c.full, 0),
    totalCuts: courses.reduce((n, c) => n + c.cuts.length, 0),
    cutGroups,
  };
}
