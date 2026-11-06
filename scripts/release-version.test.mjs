import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseVersion } from "./release-version.mjs";
const base = {
  version: "0.1.1",
  desktopVersion: "0.1.1",
  cargoVersion: "0.1.1",
  defaultBranch: "master",
};
test("Hauptbranch veröffentlicht ohne manuell erstellten Tag", () =>
  assert.deepEqual(releaseVersion({ ...base, ref: "refs/heads/master" }), {
    tag: "v0.1.1",
    publish: true,
  }));
test("Andere Branches erstellen nur Artefakte", () =>
  assert.equal(
    releaseVersion({ ...base, ref: "refs/heads/feature/test" }).publish,
    false,
  ));
test("Passender Versions-Tag veröffentlicht", () =>
  assert.equal(
    releaseVersion({ ...base, ref: "refs/tags/v0.1.1" }).publish,
    true,
  ));
test("Falscher Tag und inkonsistente Versionen schlagen fehl", () => {
  assert.throws(() => releaseVersion({ ...base, ref: "refs/tags/v0.1.0" }));
  assert.throws(() =>
    releaseVersion({
      ...base,
      desktopVersion: "0.1.0",
      ref: "refs/heads/master",
    }),
  );
});
test("Verwendet den eingestellten Hauptbranch", () =>
  assert.equal(
    releaseVersion({ ...base, defaultBranch: "main", ref: "refs/heads/main" })
      .publish,
    true,
  ));
test("Vorabversionen und unzulässige Versionszeichen", () => {
  assert.equal(
    releaseVersion({
      ...base,
      version: "0.2.0-beta.1",
      desktopVersion: "0.2.0-beta.1",
      cargoVersion: "0.2.0-beta.1",
      ref: "refs/heads/master",
    }).tag,
    "v0.2.0-beta.1",
  );
  assert.throws(() =>
    releaseVersion({
      ...base,
      version: "$(echo test)",
      ref: "refs/heads/master",
    }),
  );
});
