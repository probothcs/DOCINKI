export const MISSING_DIMS =
  "AI nie podało długości albo wysokości. Wpisz je ręcznie — docinki policzą się same.";

const NO_PHOTO =
  "Nie udało się odczytać zdjęcia. Wpisz długość i wysokość ręcznie — docinki policzą się same.";

const NO_SERVER =
  "Ta kopia nie jest połączona z serwerem, więc nie odczyta wymiarów ze zdjęcia. Wpisz długość i wysokość ręcznie — docinki policzą się na telefonie.";

export function explainAnalyzeError(error: unknown): string {
  const raw = error instanceof Error ? error.message.trim() : "";
  if (!raw || raw === "no image") return NO_PHOTO;
  if (raw === "Brak adresu serwera") return NO_SERVER;
  return raw;
}
