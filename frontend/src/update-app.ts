export const GITHUB_REPO = "probothcs/DOCINKI";
export const PUBLISHED_ORIGIN = "https://probothcs.github.io";
export const PUBLISHED_BASE = "/DOCINKI/";

export type UpdateDecision =
  | { kind: "reload"; href: string; message: string }
  | { kind: "toast"; message: string; error?: boolean };

const WAITING = "Nowa wersja jest na GitHubie. Publikacja jeszcze trwa — spróbuj za chwilę.";

export function isPublishedSite(href: string): boolean {
  try {
    return new URL(href).hostname.endsWith("github.io");
  } catch {
    return false;
  }
}

export function publishedVersionUrl(href: string): string {
  try {
    const url = new URL(href);
    if (url.hostname.endsWith("github.io")) {
      const base = url.pathname.startsWith("/DOCINKI") ? "/DOCINKI/" : "/";
      return `${url.origin}${base}version.json`;
    }
  } catch {
    /* use the canonical Pages address */
  }
  return `${PUBLISHED_ORIGIN}${PUBLISHED_BASE}version.json`;
}

export function planAppUpdate(input: {
  embeddedSha: string;
  publishedSha: string | null;
  githubSha: string | null;
  href: string;
}): UpdateDecision {
  const embedded = input.embeddedSha.trim();
  const published = input.publishedSha?.trim() || null;
  const github = input.githubSha?.trim() || null;
  const onSite = isPublishedSite(input.href);

  if (onSite) {
    if (!published && !github) {
      return { kind: "toast", error: true, message: "Nie udało się sprawdzić aktualizacji" };
    }
    if (published && embedded && published !== embedded) {
      return { kind: "reload", href: withVersion(input.href, published), message: "Pobieram nową wersję…" };
    }
    if (github && published && github !== published) {
      return { kind: "toast", error: true, message: WAITING };
    }
    if (github && !published && embedded && github !== embedded) {
      return { kind: "toast", error: true, message: WAITING };
    }
    return { kind: "toast", message: "Masz już najnowszą wersję" };
  }

  if (!published) {
    return {
      kind: "toast",
      error: true,
      message: github ? WAITING : "Nie udało się sprawdzić aktualizacji",
    };
  }
  return {
    kind: "reload",
    href: withVersion(`${PUBLISHED_ORIGIN}${PUBLISHED_BASE}`, published),
    message: "Otwieram wersję z GitHuba…",
  };
}

export async function checkForUpdate(input: {
  embeddedSha: string;
  href: string;
  fetchImpl?: typeof fetch;
}): Promise<UpdateDecision> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const [publishedSha, githubSha] = await Promise.all([
    readSha(publishedVersionUrl(input.href), fetchImpl, "version"),
    readSha(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, fetchImpl, "github"),
  ]);
  return planAppUpdate({
    embeddedSha: input.embeddedSha,
    publishedSha,
    githubSha,
    href: input.href,
  });
}

async function readSha(url: string, fetchImpl: typeof fetch, source: "version" | "github"): Promise<string | null> {
  try {
    const response = await withTimeout(
      fetchImpl(url, {
        headers: source === "github" ? { Accept: "application/vnd.github+json" } : undefined,
        cache: "no-store",
      }),
      8000,
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { sha?: unknown };
    return typeof body.sha === "string" && body.sha ? body.sha : null;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function withVersion(href: string, sha: string): string {
  const url = new URL(href);
  url.searchParams.set("v", sha);
  url.hash = "";
  return url.toString();
}
