import { invoke, isTauri } from "@tauri-apps/api/core";
import { initial, validateEntry, type State } from "./core";
import { DateTime } from "luxon";
export async function load(): Promise<State> {
  const raw = isTauri()
    ? await invoke<string | null>("load_state")
    : localStorage.getItem("tectracker");
  return raw ? parseBackup(raw) : initial();
}
let queue = Promise.resolve();
export async function backupBeforeRestore(state: State) {
  await queue;
  const data = JSON.stringify(state);
  if (isTauri()) await invoke("backup_state", { data });
  else {
    localStorage.setItem("tectracker-backup-before-restore", data);
    download("tectracker-vor-wiederherstellung.json", data);
  }
}
export function save(state: State) {
  const raw = JSON.stringify(state);
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (isTauri()) await invoke("save_state", { data: raw });
      else localStorage.setItem("tectracker", raw);
    });
  return queue;
}
export function parseBackup(raw: string): State {
  const x = JSON.parse(raw) as State;
  if (
    !x ||
    x.version !== 1 ||
    !Array.isArray(x.profiles) ||
    !x.profiles.length ||
    !Array.isArray(x.entries) ||
    !Array.isArray(x.entities) ||
    !Array.isArray(x.days) ||
    !Array.isArray(x.journal) ||
    !Number.isSafeInteger(x.revision) ||
    !["system", "dark", "light"].includes(x.theme)
  )
    throw Error("Ungültige oder nicht unterstützte Sicherung.");
  const ids = new Set<string>();
  for (const item of [...x.profiles, ...x.entities, ...x.entries]) {
    if (typeof item.id !== "string" || !item.id || ids.has(item.id))
      throw Error("Ungültige oder doppelte ID.");
    ids.add(item.id);
  }
  if (!x.profiles.some((p) => !p.archived))
    throw Error("Mindestens ein aktives Profil erforderlich.");
  for (const p of x.profiles) {
    if (
      typeof p.name !== "string" ||
      !DateTime.now().setZone(p.zone).isValid ||
      !Array.isArray(p.plans) ||
      !p.plans.length
    )
      throw Error("Ungültiges Profil.");
    for (const plan of p.plans)
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(plan.from) ||
        !DateTime.fromISO(plan.from).isValid ||
        !Number.isSafeInteger(plan.seconds) ||
        plan.seconds < 0 ||
        plan.seconds > 604800 ||
        !Array.isArray(plan.days) ||
        !plan.days.length ||
        new Set(plan.days).size !== plan.days.length ||
        plan.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
      )
        throw Error("Ungültiger Arbeitszeitplan.");
  }
  for (const e of x.entities)
    if (
      !x.profiles.some((p) => p.id === e.profileId) ||
      typeof e.name !== "string" ||
      !["category", "tag", "project", "customer", "rate"].includes(e.kind) ||
      (e.kind === "rate" && (!Number.isSafeInteger(e.cents) || e.cents! < 0))
    )
      throw Error("Ungültige Stammdaten.");
  if (x.entries.filter((e) => !e.end && !e.deleted).length > 1)
    throw Error("Mehrere aktive Timer in der Sicherung.");
  for (const e of x.entries) {
    if (
      !x.profiles.some((p) => p.id === e.profileId) ||
      typeof e.name !== "string" ||
      !Array.isArray(e.pauses) ||
      !Array.isArray(e.tags) ||
      e.tags.some((t) => typeof t !== "string") ||
      (e.rateCents !== undefined &&
        (!Number.isSafeInteger(e.rateCents) || e.rateCents < 0))
    )
      throw Error("Ungültiger Zeiteintrag.");
    if (!e.deleted) validateEntry(x, e);
  }
  for (const d of x.days)
    if (
      !x.profiles.some((p) => p.id === d.profileId) ||
      !DateTime.fromISO(d.date).isValid ||
      !Number.isFinite(d.actual) ||
      d.actual < 0 ||
      !Number.isFinite(d.planned) ||
      d.planned < 0 ||
      !["", "Urlaub", "Krankheit", "Frei"].includes(d.absence)
    )
      throw Error("Ungültige Tagesangaben.");
  return x;
}
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  if (isTauri()) {
    void invoke("export_file", { name, data: text }).catch((e) =>
      window.alert("Export fehlgeschlagen: " + e),
    );
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
