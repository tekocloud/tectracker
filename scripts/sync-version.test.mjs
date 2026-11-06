import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncVersion } from "./sync-version.mjs";
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tectracker-version-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "src-tauri"));
  const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
  write("package.json", '{"name":"tectracker","version":"0.1.2"}');
  write(
    "package-lock.json",
    '{"version":"0.1.1","packages":{"":{"version":"0.1.1"},"node_modules/demo":{"version":"0.1.1"}}}',
  );
  write(
    "src-tauri/tauri.conf.json",
    '{"version":"0.1.1","productName":"TecTracker"}',
  );
  write(
    "src-tauri/Cargo.toml",
    '[package]\nname = "tectracker"\nversion = "0.1.1"\n[dependencies]\ndemo = "0.1.1"\n',
  );
  write(
    "src-tauri/Cargo.lock",
    '[[package]]\nname = "demo"\nversion = "0.1.1"\n\n[[package]]\nname = "tectracker"\nversion = "0.1.1"\n',
  );
  return root;
}
test("gleicht Dateien ab und lässt Abhängigkeiten unverändert", (t) => {
  const root = fixture(t);
  assert.equal(syncVersion(root), "0.1.2");
  const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
  assert.match(read("src-tauri/Cargo.toml"), /version = "0.1.2"/);
  assert.match(read("src-tauri/Cargo.toml"), /demo = "0.1.1"/);
  assert.match(
    read("src-tauri/Cargo.lock"),
    /name = "demo"\nversion = "0.1.1"/,
  );
  assert.match(
    read("src-tauri/Cargo.lock"),
    /name = "tectracker"\nversion = "0.1.2"/,
  );
  for (const file of [
    "package.json",
    "package-lock.json",
    "src-tauri/tauri.conf.json",
  ])
    assert.equal(JSON.parse(read(file)).version, "0.1.2");
  assert.equal(
    JSON.parse(read("package-lock.json")).packages[""].version,
    "0.1.2",
  );
});
test("setzt eine neue Version in allen Manifesten", (t) => {
  const root = fixture(t);
  assert.equal(syncVersion(root, "0.2.0-beta.1"), "0.2.0-beta.1");
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
      .version,
    "0.2.0-beta.1",
  );
});
test("ungültige Eingaben und fehlende App-Lockeinträge ändern nichts", (t) => {
  const root = fixture(t),
    file = path.join(root, "package.json"),
    before = fs.readFileSync(file, "utf8");
  assert.throws(() => syncVersion(root, "invalid"));
  assert.equal(fs.readFileSync(file, "utf8"), before);
  fs.writeFileSync(
    path.join(root, "src-tauri/Cargo.lock"),
    '[[package]]\nname = "demo"\nversion = "0.1.1"',
  );
  assert.throws(() => syncVersion(root, "0.2.0"));
  assert.equal(fs.readFileSync(file, "utf8"), before);
});
