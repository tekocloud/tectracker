import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Prepare every update before writing, so missing manifests do not cause partial changes.
export function syncVersion(root, requestedVersion) {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const pkg = JSON.parse(read("package.json"));
  const version = requestedVersion ?? pkg.version;
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version)
  )
    throw Error(
      "Ungültige Version, beispielsweise 0.1.2 oder 0.2.0-beta.1 verwenden.",
    );
  const lock = JSON.parse(read("package-lock.json"));
  const desktop = JSON.parse(read("src-tauri/tauri.conf.json"));
  const cargo = read("src-tauri/Cargo.toml");
  const cargoLock = read("src-tauri/Cargo.lock");
  const manifestPattern = /(\[package\][\s\S]*?^version\s*=\s*")[^"]+(".*$)/m;
  const lockPattern =
    /(\[\[package\]\]\r?\nname = "tectracker"\r?\nversion = ")[^"]+(")/;
  if (
    !manifestPattern.test(cargo) ||
    !lockPattern.test(cargoLock) ||
    !lock.packages?.[""]
  )
    throw Error(
      "App-Version in Manifest oder Lockdatei nicht gefunden. Keine Dateien geändert.",
    );
  pkg.version = version;
  lock.version = version;
  lock.packages[""].version = version;
  desktop.version = version;
  const json = (x) => JSON.stringify(x, null, 2) + "\n";
  const files = {
    "package.json": json(pkg),
    "package-lock.json": json(lock),
    "src-tauri/tauri.conf.json": json(desktop),
    "src-tauri/Cargo.toml": cargo.replace(
      manifestPattern,
      (_, a, b) => a + version + b,
    ),
    "src-tauri/Cargo.lock": cargoLock.replace(
      lockPattern,
      (_, a, b) => a + version + b,
    ),
  };
  for (const [file, text] of Object.entries(files))
    fs.writeFileSync(path.join(root, file), text);
  return version;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(
    `App-Version in allen fünf Dateien: ${syncVersion(process.cwd(), process.argv[2])}`,
  );
}
