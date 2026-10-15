import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_VERSION, nextPublishedVersion } from "../src/app-version.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function publishedVersion(): Promise<string | null> {
  try {
    const response = await fetch("https://probothcs.github.io/DOCINKI/version.json", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

const version = nextPublishedVersion(APP_VERSION, await publishedVersion());
const sha = process.env.GITHUB_SHA ?? "";
writeFileSync(join(root, "public/version.json"), `${JSON.stringify({ sha, version })}\n`);
process.stdout.write(`${version}\n`);
