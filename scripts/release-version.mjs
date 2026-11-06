import fs from "node:fs";
import { pathToFileURL } from "node:url";

export function releaseVersion({
  version,
  desktopVersion,
  cargoVersion,
  ref,
  defaultBranch,
}) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version)) {
    throw new Error(
      "Ungültige Release-Version. Erwartet wird beispielsweise 0.1.1 oder 0.2.0-beta.1.",
    );
  }
  if (desktopVersion !== version || cargoVersion !== version) {
    throw new Error(
      "Versionen in package.json, Cargo.toml und tauri.conf.json müssen übereinstimmen.",
    );
  }
  const tag = `v${version}`;
  if (ref.startsWith("refs/tags/") && ref !== `refs/tags/${tag}`) {
    throw new Error(`Der Release-Tag muss ${tag} heißen.`);
  }
  return {
    tag,
    publish:
      ref === `refs/heads/${defaultBranch}` || ref === `refs/tags/${tag}`,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const desktop = JSON.parse(
    fs.readFileSync("src-tauri/tauri.conf.json", "utf8"),
  );
  const cargoVersion = fs
    .readFileSync("src-tauri/Cargo.toml", "utf8")
    .match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  const result = releaseVersion({
    version: pkg.version,
    desktopVersion: desktop.version,
    cargoVersion,
    ref: process.env.RELEASE_REF || "",
    defaultBranch: process.env.DEFAULT_BRANCH || "",
  });
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `tag=${result.tag}\npublish=${result.publish}\n`,
    );
  }
  console.log(
    `${result.tag}: ${result.publish ? "Release veröffentlichen" : "Nur Build-Artefakte"}`,
  );
}
