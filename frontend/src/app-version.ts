export const APP_VERSION = "0.0.2";

export function currentAppVersion(): string {
  const fromBuild = process.env.EXPO_PUBLIC_APP_VERSION?.trim();
  return fromBuild || APP_VERSION;
}

export function parseVersion(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a) ?? [0, 0, 0];
  const right = parseVersion(b) ?? [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

export function bumpPatch(version: string): string {
  const parts = parseVersion(version) ?? [0, 0, 0];
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

/** Next number published to the phone. Only the same X.Y line keeps climbing; a new line starts at the source number. */
export function nextPublishedVersion(source: string, published: string | null): string {
  const base = parseVersion(source) ? source.trim() : APP_VERSION;
  const publishedParts = published ? parseVersion(published) : null;
  const sourceParts = parseVersion(base);
  if (!publishedParts || !sourceParts) return base;
  const sameLine = sourceParts[0] === publishedParts[0] && sourceParts[1] === publishedParts[1];
  if (!sameLine || publishedParts[2] < sourceParts[2]) return base;
  return bumpPatch(published);
}
