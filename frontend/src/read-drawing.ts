export type OcrToken = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DrawingDims = {
  name: string;
  length: number | null;
  height: number | null;
  thickness: number | null;
  notes: string;
};

type Hit = { value: number; raw: string; x: number; y: number; width: number; height: number };

const PREFERRED_THICKNESS = [10, 11, 12, 14, 14.5, 15, 16, 18, 19, 20];

export function readDrawingTokens(tokens: OcrToken[], imageWidth: number, imageHeight: number): DrawingDims {
  const width = imageWidth > 0 ? imageWidth : 1;
  const height = imageHeight > 0 ? imageHeight : 1;
  const hits = tokens.flatMap((token) => hitsIn(token));
  const dims = hits.filter((hit) => !isElevation(hit));
  const name = findName(tokens);

  const thickness = pickThickness(dims);
  const alone = isolated(dims);
  const heightHit = pickHeight(alone, width, height, thickness);
  const lengthHit = pickLength(alone, width, height, thickness, heightHit);

  const chosen = [lengthHit?.value, heightHit?.value, thickness].filter((n) => n != null);
  const others = unique(dims.map((hit) => hit.value)).filter((n) => !chosen.includes(n));
  const notes = [
    "Odczyt w telefonie, bez internetu. Sprawdź liczby.",
    lengthHit ? `Długość ${formatNum(lengthHit.value)} cm.` : "Długości nie widzę.",
    heightHit ? `Wysokość ${formatNum(heightHit.value)} cm.` : "Wysokości nie widzę.",
    thickness != null ? `Grubość ${formatNum(thickness)} cm.` : "Grubość: zostawiam 14 cm.",
    others.length ? `Inne liczby: ${others.map(formatNum).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    name,
    length: lengthHit?.value ?? null,
    height: heightHit?.value ?? null,
    thickness,
    notes,
  };
}

function hitsIn(token: OcrToken): Hit[] {
  const matches = token.text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((raw) => ({
    value: Number(raw.replace(",", ".")),
    raw,
    x: token.x + token.width / 2,
    y: token.y + token.height / 2,
    width: token.width,
    height: token.height,
  }));
}

function isElevation(hit: Hit): boolean {
  if (hit.value >= 800) return true;
  return /[.,]\d/.test(hit.raw) && hit.value >= 100;
}

function findName(tokens: OcrToken[]): string {
  const sorted = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const label = sorted.find((token) => /element\s*nr/i.test(token.text));
  if (label) {
    const near = sorted.find((token) => {
      const compact = compactName(token.text);
      return compact && token.x >= label.x - 10 && Math.abs(token.y - label.y) < label.height * 3;
    });
    if (near) return compactName(near.text);
  }
  for (const token of sorted) {
    const compact = compactName(token.text);
    if (compact && !/^BR/i.test(compact)) return compact;
  }
  return "";
}

function compactName(text: string): string {
  const compact = text.replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z]{1,3}\d{0,2}-\d{3,}$/.test(compact)) return compact;
  if (/^[A-Z]\d{4,}$/.test(compact)) return compact;
  return "";
}

function pickThickness(hits: Hit[]): number | null {
  const pool = hits.filter((hit) => hit.value >= 10 && hit.value <= 20);
  if (!pool.length) return null;
  const preferred = pool.find((hit) => PREFERRED_THICKNESS.some((n) => Math.abs(n - hit.value) < 0.26));
  return (preferred ?? pool[0]).value;
}

function pickHeight(hits: Hit[], imageWidth: number, imageHeight: number, thickness: number | null): Hit | null {
  const pool = hits.filter((hit) => hit.value >= 180 && hit.value <= 420 && hit.value !== thickness);
  const side = pool.filter((hit) => isSide(hit, imageWidth));
  const source = side.length ? side : pool.filter((hit) => !isBand(hit, imageHeight));
  return tallest(source.length ? source : pool);
}

function pickLength(
  hits: Hit[],
  imageWidth: number,
  imageHeight: number,
  thickness: number | null,
  heightHit: Hit | null,
): Hit | null {
  const pool = hits.filter((hit) => {
    if (hit.value < 40 || hit.value > 900 || hit.value === thickness) return false;
    if (heightHit && sameHit(hit, heightHit)) return false;
    return true;
  });
  const band = pool.filter((hit) => isBand(hit, imageHeight) && !isSide(hit, imageWidth));
  return tallest(band.length ? band : pool);
}

function isolated(hits: Hit[]): Hit[] {
  return hits.filter((hit) => {
    const neighbors = hits.filter(
      (other) => other !== hit && Math.abs(other.x - hit.x) < 90 && Math.abs(other.y - hit.y) < 36,
    );
    return neighbors.length === 0;
  });
}

function tallest(hits: Hit[]): Hit | null {
  return hits.reduce<Hit | null>((best, hit) => (best == null || hit.value > best.value ? hit : best), null);
}

function isSide(hit: Hit, imageWidth: number): boolean {
  return hit.x < imageWidth * 0.18 || hit.x > imageWidth * 0.82;
}

function isBand(hit: Hit, imageHeight: number): boolean {
  return hit.y < imageHeight * 0.2 || hit.y > imageHeight * 0.8;
}

function sameHit(a: Hit, b: Hit): boolean {
  return a.value === b.value && a.x === b.x && a.y === b.y;
}

function unique(values: number[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const value of values) {
    const key = String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}
