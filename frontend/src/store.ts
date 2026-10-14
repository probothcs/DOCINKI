import { useEffect, useState } from "react";

import { DEFAULT_SETTINGS, normalizeSettings, Settings, WallInput } from "./calc";
import { storage } from "./utils/storage";

const KEY = "docinki-settings";

let current: Settings = DEFAULT_SETTINGS;
const listeners = new Set<(s: Settings) => void>();

storage.getItem(KEY, null).then((raw) => {
  if (typeof raw === "string") {
    try {
      current = normalizeSettings(JSON.parse(raw));
      listeners.forEach((l) => l(current));
    } catch {}
  }
});

export async function saveSettings(s: Settings) {
  current = s;
  listeners.forEach((l) => l(s));
  return storage.setItem(KEY, JSON.stringify(s));
}

export function useSettings() {
  const [s, setS] = useState(current);
  useEffect(() => {
    listeners.add(setS);
    setS(current);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

// Draft wall passed from Nowa -> Edytuj -> Wynik
export type Draft = WallInput & { notes?: string };
let draft: Draft = { name: "", length: 0, height: 0, thickness: 14, openings: [] };
export const getDraft = () => draft;
export const setDraft = (d: Draft) => {
  draft = d;
};
