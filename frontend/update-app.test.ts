import assert from "node:assert/strict";

import { APP_VERSION, nextPublishedVersion } from "./src/app-version.ts";
import { explainAnalyzeError, MISSING_DIMS } from "./src/analyze-error.ts";
import { checkForUpdate, planAppUpdate, publishedVersionUrl } from "./src/update-app.ts";

const page = "https://probothcs.github.io/DOCINKI/";
const local = "http://127.0.0.1:8081/";

assert.equal(APP_VERSION, "0.0.2");
assert.equal(nextPublishedVersion("0.0.1", null), "0.0.1");
assert.equal(nextPublishedVersion("0.0.1", "brak"), "0.0.1");
assert.equal(nextPublishedVersion("0.0.1", "0.0.1"), "0.0.2");
assert.equal(nextPublishedVersion("0.0.1", "0.0.4"), "0.0.5");
assert.equal(nextPublishedVersion("0.0.1", "1.0.0"), "0.0.1");
assert.equal(nextPublishedVersion("0.1.0", "0.0.9"), "0.1.0");
assert.equal(nextPublishedVersion("0.1.0", "0.1.2"), "0.1.3");

const same = planAppUpdate({
  embeddedSha: "abc",
  publishedSha: "abc",
  githubSha: "abc",
  embeddedVersion: "0.0.1",
  publishedVersion: "0.0.1",
  href: page,
});
assert.equal(same.kind, "toast");
assert.equal(same.kind === "toast" && same.message, "Masz najnowszą wersję 0.0.1");

const newer = planAppUpdate({
  embeddedSha: "old",
  publishedSha: "new",
  githubSha: "new",
  embeddedVersion: "0.0.1",
  publishedVersion: "0.0.2",
  href: page,
});
assert.equal(newer.kind, "reload");
assert.equal(newer.kind === "reload" && newer.href, "https://probothcs.github.io/DOCINKI/?v=new");
assert.equal(newer.kind === "reload" && newer.message, "Jest nowsza wersja 0.0.2. Pobieram…");

const republish = planAppUpdate({
  embeddedSha: "old",
  publishedSha: "new",
  githubSha: "new",
  embeddedVersion: "0.0.1",
  publishedVersion: "0.0.1",
  href: page,
});
assert.equal(republish.kind, "reload");
assert.equal(republish.kind === "reload" && republish.message, "Jest nowsza publikacja wersji 0.0.1. Pobieram…");

const waiting = planAppUpdate({
  embeddedSha: "old",
  publishedSha: "old",
  githubSha: "new",
  embeddedVersion: "0.0.1",
  publishedVersion: "0.0.1",
  href: page,
});
assert.equal(waiting.kind, "toast");
assert.equal(waiting.kind === "toast" && waiting.error, true);

const offline = planAppUpdate({
  embeddedSha: "old",
  publishedSha: null,
  githubSha: null,
  embeddedVersion: "0.0.1",
  publishedVersion: null,
  href: page,
});
assert.equal(offline.kind === "toast" && offline.error, true);

const devWaiting = planAppUpdate({
  embeddedSha: "",
  publishedSha: null,
  githubSha: "new",
  embeddedVersion: "0.0.1",
  publishedVersion: null,
  href: local,
});
assert.equal(devWaiting.kind, "toast");
assert.equal(devWaiting.kind === "toast" && devWaiting.error, true);

const openGithub = planAppUpdate({
  embeddedSha: "",
  publishedSha: "abc",
  githubSha: "abc",
  embeddedVersion: "0.0.1",
  publishedVersion: "0.0.3",
  href: local,
});
assert.equal(openGithub.kind, "reload");
assert.equal(openGithub.kind === "reload" && openGithub.href, "https://probothcs.github.io/DOCINKI/?v=abc");
assert.equal(openGithub.kind === "reload" && openGithub.message, "Otwieram wersję 0.0.3 z GitHuba…");

assert.equal(publishedVersionUrl(page), "https://probothcs.github.io/DOCINKI/version.json");
assert.equal(publishedVersionUrl(local), "https://probothcs.github.io/DOCINKI/version.json");

const fetched = await checkForUpdate({
  embeddedSha: "old",
  embeddedVersion: "0.0.1",
  href: page,
  fetchImpl: async (url) => {
    const target = String(url);
    if (target.endsWith("version.json")) return Response.json({ sha: "new", version: "0.0.2" });
    if (target.includes("api.github.com")) return Response.json({ sha: "new" });
    return new Response("missing", { status: 404 });
  },
});
assert.equal(fetched.kind, "reload");
assert.equal(fetched.kind === "reload" && fetched.href, "https://probothcs.github.io/DOCINKI/?v=new");
assert.equal(fetched.kind === "reload" && fetched.message, "Jest nowsza wersja 0.0.2. Pobieram…");

assert.equal(explainAnalyzeError(new Error("Brak adresu serwera")).includes("nie jest połączona z serwerem"), true);
assert.equal(explainAnalyzeError(new Error("no image")).includes("Wpisz długość i wysokość"), true);
assert.equal(explainAnalyzeError(new Error(MISSING_DIMS)), MISSING_DIMS);

console.log("update-app tests passed");
