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

// Draft walls passed from Nowa -> Edytuj -> Wynik (several walls can be calculated together)
export type Draft = WallInput & { notes?: string };
export const EMPTY_DRAFT: Draft = { name: "", length: 0, height: 0, thickness: 14, openings: [] };
let drafts: Draft[] = [];
let editIndex = 0;
const draftListeners = new Set<() => void>();
const setDrafts = (d: Draft[]) => {
  drafts = d;
  draftListeners.forEach((l) => l());
};
export const getDrafts = () => drafts;
export const getDraft = () => drafts[editIndex] ?? EMPTY_DRAFT;
export const setDraft = (d: Draft) => {
  const next = [...drafts];
  next[editIndex] = d;
  setDrafts(next);
};
export const setEditIndex = (i: number) => {
  editIndex = i;
};
export const startNewBatch = (d: Draft) => {
  editIndex = 0;
  setDrafts([d]);
};
export const addDraft = (d: Draft) => {
  editIndex = drafts.length;
  setDrafts([...drafts, d]);
};
export const removeDraft = (i: number) => setDrafts(drafts.filter((_, j) => j !== i));
export const isValidDraft = (d: Draft) => d.length > 0 && d.height > 0;

export function useDrafts() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    draftListeners.add(l);
    return () => {
      draftListeners.delete(l);
    };
  }, []);
  return drafts;
}
