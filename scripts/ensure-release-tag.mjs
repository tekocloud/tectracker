import { pathToFileURL } from "node:url";

export async function ensureReleaseTag({
  repo,
  tag,
  sha,
  token,
  fetchImpl = fetch,
}) {
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repo || "") ||
    !/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(tag || "") ||
    !/^[a-f0-9]{40}$/.test(sha || "") ||
    !token
  )
    throw Error(
      "Repository, Release-Tag, Commit-SHA oder GitHub-Token fehlt bzw. ist ungültig.",
    );
  const base = `https://api.github.com/repos/${repo}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const reference = await fetchImpl(
    `${base}/git/ref/tags/${encodeURIComponent(tag)}`,
    { headers },
  );
  if (reference.status === 404) {
    const created = await fetchImpl(`${base}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha }),
    });
    if (!created.ok)
      throw Error(
        `Tag ${tag} konnte nicht erstellt werden (HTTP ${created.status}). GitHub-Schreibrechte und Tag-Regeln prüfen.`,
      );
    const result = await created.json();
    if (result.object?.sha !== sha)
      throw Error(
        "GitHub hat einen unerwarteten Commit für den neuen Tag zurückgegeben.",
      );
    return { created: true, sha };
  }
  if (!reference.ok)
    throw Error(
      `Tag ${tag} konnte nicht geprüft werden (HTTP ${reference.status}). GitHub-Zugriff prüfen.`,
    );
  // Resolve the fully qualified tag to a commit, including annotated tags.
  const response = await fetchImpl(
    `${base}/commits/${encodeURIComponent(`refs/tags/${tag}`)}`,
    { headers },
  );
  if (!response.ok)
    throw Error(
      `Tag ${tag} konnte nicht geprüft werden (HTTP ${response.status}). GitHub-Zugriff prüfen.`,
    );
  const result = await response.json();
  if (!/^[a-f0-9]{40}$/.test(result.sha || ""))
    throw Error("GitHub lieferte keinen gültigen Commit.");
  if (result.sha !== sha)
    throw Error(
      `Tag ${tag} zeigt auf ${result.sha}, dieser Build stammt von ${sha}. Existierende Tags werden nicht verschoben.`,
    );
  return { created: false, sha };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await ensureReleaseTag({
    repo: process.env.GH_REPO,
    tag: process.env.RELEASE_TAG,
    sha: process.env.RELEASE_SHA,
    token: process.env.GH_TOKEN,
  });
  console.log(
    `${process.env.RELEASE_TAG}: ${result.created ? "Tag erstellt" : "Commit stimmt überein"} (${result.sha})`,
  );
}
