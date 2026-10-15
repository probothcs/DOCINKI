import assert from "node:assert/strict";

import { checkForUpdate, planAppUpdate, publishedVersionUrl } from "./src/update-app.ts";

const page = "https://probothcs.github.io/DOCINKI/";
const local = "http://127.0.0.1:8081/";

const same = planAppUpdate({
  embeddedSha: "abc",
  publishedSha: "abc",
  githubSha: "abc",
  href: page,
});
assert.equal(same.kind, "toast");
assert.equal(same.kind === "toast" && same.message, "Masz już najnowszą wersję");

const newer = planAppUpdate({
  embeddedSha: "old",
  publishedSha: "new",
  githubSha: "new",
  href: page,
});
assert.equal(newer.kind, "reload");
assert.equal(newer.kind === "reload" && newer.href, "https://probothcs.github.io/DOCINKI/?v=new");

const waiting = planAppUpdate({
  embeddedSha: "old",
  publishedSha: "old",
  githubSha: "new",
  href: page,
});
assert.equal(waiting.kind, "toast");
assert.equal(waiting.kind === "toast" && waiting.error, true);

const offline = planAppUpdate({
  embeddedSha: "old",
  publishedSha: null,
  githubSha: null,
  href: page,
});
assert.equal(offline.kind === "toast" && offline.error, true);

const dev = planAppUpdate({
  embeddedSha: "",
  publishedSha: null,
  githubSha: "new",
  href: local,
});
assert.equal(dev.kind, "reload");
assert.equal(dev.kind === "reload" && dev.message, "Odświeżono");

assert.equal(publishedVersionUrl(page), "https://probothcs.github.io/DOCINKI/version.json");
assert.equal(publishedVersionUrl(local), "https://probothcs.github.io/DOCINKI/version.json");

const fetched = await checkForUpdate({
  embeddedSha: "old",
  href: page,
  fetchImpl: async (url) => {
    const target = String(url);
    if (target.endsWith("version.json")) return Response.json({ sha: "new" });
    if (target.includes("api.github.com")) return Response.json({ sha: "new" });
    return new Response("missing", { status: 404 });
  },
});
assert.equal(fetched.kind, "reload");
assert.equal(fetched.kind === "reload" && fetched.href, "https://probothcs.github.io/DOCINKI/?v=new");

console.log("update-app tests passed");
