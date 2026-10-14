import type { CalcResult, Opening, Settings, WallInput } from "./calc";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type AnalyzeResult = {
  name: string;
  length: number | null;
  height: number | null;
  thickness: number | null;
  openings: Opening[];
  notes: string;
};

export type SavedWall = WallInput & { id: string; created_at: string; project?: string; settings: Settings; result: CalcResult };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Błąd ${res.status}`);
  }
  return res.json();
}

export const api = {
  analyze: (image_base64: string) =>
    req<AnalyzeResult>("/analyze", { method: "POST", body: JSON.stringify({ image_base64 }) }),
  listWalls: () => req<SavedWall[]>("/walls"),
  getWall: (id: string) => req<SavedWall>(`/walls/${id}`),
  saveWall: (w: WallInput & { project?: string; settings: Settings; result: CalcResult }) =>
    req<SavedWall>("/walls", { method: "POST", body: JSON.stringify(w) }),
  deleteWall: (id: string) => req<{ ok: boolean }>(`/walls/${id}`, { method: "DELETE" }),
};
