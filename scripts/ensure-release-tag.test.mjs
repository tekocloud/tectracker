import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureReleaseTag } from "./ensure-release-tag.mjs";
const sha = "a".repeat(40),
  other = "b".repeat(40);
const base = {
  repo: "tekocloud/tectracker",
  tag: "v0.1.3",
  sha,
  token: "test-token",
};
const response = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});
test("404-Fehlerkörper wird nicht als Commit behandelt: fehlenden Tag erstellen", async () => {
  const calls = [];
  const result = await ensureReleaseTag({
    ...base,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? response(404, { message: "Not Found" })
        : response(201, { object: { sha } });
    },
  });
  assert.equal(result.created, true);
  assert.equal(calls.length, 2);
  assert.equal(
    calls[0].url,
    "https://api.github.com/repos/tekocloud/tectracker/git/ref/tags/v0.1.3",
  );
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    ref: "refs/tags/v0.1.3",
    sha,
  });
});
test("existierender passender Tag wird ohne Schreibzugriff übernommen", async () => {
  let calls = 0;
  assert.equal(
    (
      await ensureReleaseTag({
        ...base,
        fetchImpl: async () => {
          calls++;
          return response(200, { sha });
        },
      })
    ).created,
    false,
  );
  assert.equal(calls, 2);
});
test("echter Tag-Konflikt nennt beide Commits und verändert nichts", async () => {
  let calls = 0;
  await assert.rejects(
    ensureReleaseTag({
      ...base,
      fetchImpl: async () => {
        calls++;
        return response(200, { sha: other });
      },
    }),
    new RegExp(other),
  );
  assert.equal(calls, 2);
});
test("fehlende Berechtigung ist kein fehlender Tag", async () => {
  let calls = 0;
  await assert.rejects(
    ensureReleaseTag({
      ...base,
      fetchImpl: async () => {
        calls++;
        return response(403, { message: "Forbidden" });
      },
    }),
    /HTTP 403/,
  );
  assert.equal(calls, 1);
});
test("Tag-Erstellungsfehler bleibt sichtbar", async () => {
  let calls = 0;
  await assert.rejects(
    ensureReleaseTag({
      ...base,
      fetchImpl: async () =>
        ++calls === 1
          ? response(404, {})
          : response(422, { message: "Reference already exists" }),
    }),
    /HTTP 422/,
  );
});
test("ungültige erfolgreiche API-Antwort wird abgelehnt", async () => {
  await assert.rejects(
    ensureReleaseTag({
      ...base,
      fetchImpl: async () => response(200, { sha: null }),
    }),
    /keinen gültigen Commit/,
  );
});

test("annotierter Tag wird über den vollständigen Tag-Verweis zum Commit aufgelöst", async () => {
  const urls = [];
  const result = await ensureReleaseTag({
    ...base,
    fetchImpl: async (url) => {
      urls.push(url);
      return urls.length === 1
        ? response(200, { object: { type: "tag", sha: other } })
        : response(200, { sha });
    },
  });
  assert.deepEqual(result, { created: false, sha });
  assert.deepEqual(urls, [
    "https://api.github.com/repos/tekocloud/tectracker/git/ref/tags/v0.1.3",
    "https://api.github.com/repos/tekocloud/tectracker/commits/refs%2Ftags%2Fv0.1.3",
  ]);
});

test("HTTP 422 bei der Tag-Abfrage erlaubt keine Tag-Erstellung", async () => {
  let calls = 0;
  await assert.rejects(
    ensureReleaseTag({
      ...base,
      fetchImpl: async () => {
        calls++;
        return response(422, { message: "Validation Failed" });
      },
    }),
    /HTTP 422/,
  );
  assert.equal(calls, 1);
});
