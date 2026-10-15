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
  embeddedVersion: string;
  publishedVersion: string | null;
  href: string;
}): UpdateDecision {
  const embedded = input.embeddedSha.trim();
  const published = input.publishedSha?.trim() || null;
  const github = input.githubSha?.trim() || null;
  const embeddedVersion = input.embeddedVersion.trim();
  const publishedVersion = input.publishedVersion?.trim() || null;
  const onSite = isPublishedSite(input.href);

  if (onSite) {
    if (!published && !github) {
      return { kind: "toast", error: true, message: "Nie udało się sprawdzić aktualizacji" };
    }
    if (published && embedded && published !== embedded) {
      return {
        kind: "reload",
        href: withVersion(input.href, published),
        message: reloadMessage(embeddedVersion, publishedVersion),
      };
    }
    if (github && published && github !== published) {
      return { kind: "toast", error: true, message: WAITING };
    }
    if (github && !published && embedded && github !== embedded) {
      return { kind: "toast", error: true, message: WAITING };
    }
    return { kind: "toast", message: sameMessage(publishedVersion || embeddedVersion) };
  }

  if (!published) {
    return {
      kind: "toast",
      error: true,
      message: github ? WAITING : "Nie udało się sprawdzić aktualizacji",
    };
  }
  const label = publishedVersion ? `Otwieram wersję ${publishedVersion} z GitHuba…` : "Otwieram wersję z GitHuba…";
  return {
    kind: "reload",
    href: withVersion(`${PUBLISHED_ORIGIN}${PUBLISHED_BASE}`, published),
    message: label,
  };
}

export async function checkForUpdate(input: {
  embeddedSha: string;
  embeddedVersion: string;
  href: string;
  fetchImpl?: typeof fetch;
}): Promise<UpdateDecision> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const [publishedRelease, githubSha] = await Promise.all([
    readRelease(publishedVersionUrl(input.href), fetchImpl, "version"),
    readRelease(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, fetchImpl, "github"),
  ]);
  return planAppUpdate({
    embeddedSha: input.embeddedSha,
    embeddedVersion: input.embeddedVersion,
    publishedSha: publishedRelease.sha,
    publishedVersion: publishedRelease.version,
    githubSha: githubSha.sha,
    href: input.href,
  });
}

async function readRelease(
  url: string,
  fetchImpl: typeof fetch,
  source: "version" | "github",
): Promise<{ sha: string | null; version: string | null }> {
  try {
    const response = await withTimeout(
      fetchImpl(url, {
        headers: source === "github" ? { Accept: "application/vnd.github+json" } : undefined,
        cache: "no-store",
      }),
      8000,
    );
    if (!response.ok) return { sha: null, version: null };
    const body = (await response.json()) as { sha?: unknown; version?: unknown };
    return {
      sha: typeof body.sha === "string" && body.sha ? body.sha : null,
      version: source === "version" && typeof body.version === "string" && body.version ? body.version : null,
    };
  } catch {
    return { sha: null, version: null };
  }
}

function compareVersions(a: string, b: string): number {
  const part = (value: string) => value.split(".").map((n) => parseInt(n, 10) || 0);
  const left = part(a);
  const right = part(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

function sameMessage(version: string): string {
  return version ? `Masz najnowszą wersję ${version}` : "Masz już najnowszą wersję";
}

function reloadMessage(embeddedVersion: string, publishedVersion: string | null): string {
  if (publishedVersion && embeddedVersion && compareVersions(publishedVersion, embeddedVersion) > 0) {
    return `Jest nowsza wersja ${publishedVersion}. Pobieram…`;
  }
  if (publishedVersion) return `Jest nowsza publikacja wersji ${publishedVersion}. Pobieram…`;
  return "Pobieram nową wersję…";
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
