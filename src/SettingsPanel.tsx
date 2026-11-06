import Select from "./Select";
import Modal from "./Modal";
import { useDialogs } from "./Dialogs";
import { useState } from "react";
import GermanDateInput, { germanDate } from "./GermanDateInput";
import { DateTime } from "luxon";
import Papa from "papaparse";
import { download, parseBackup, backupBeforeRestore } from "./storage";
import {
  uid,
  duration,
  money,
  validateEntry,
  type State,
  type Profile,
  type Entity,
  type Entry,
} from "./core";
export default function SettingsPanel({
  s,
  p,
  date,
  commit,
  setPid,
  error,
  attempt,
}: {
  s: State;
  p: Profile;
  date: string;
  commit: (s: State) => void;
  setPid: (s: string) => void;
  error: (s: string) => void;
  attempt: (fn: () => void) => void;
}) {
  const { confirm, prompt } = useDialogs();
  const [rows, Rows] = useState<Record<string, string>[]>([]),
    [map, Map] = useState<Record<string, string>>({}),
    [dupes, Dupes] = useState(false),
    [format, Format] = useState("iso"),
    [zone, Zone] = useState(p.zone);
  const rates = s.entities.filter(
    (x) => x.profileId === p.id && x.kind === "rate" && !x.archived,
  );
  const latestPlan = [...p.plans].sort((a, b) =>
    b.from.localeCompare(a.from),
  )[0];
  function profile(patch: Partial<Profile>) {
    commit({
      ...s,
      profiles: s.profiles.map((x) => (x.id === p.id ? { ...x, ...patch } : x)),
    });
  }
  function importCsv() {
    attempt(() => {
      const next = structuredClone(s),
        seen = new Set<string>(),
        errors: string[] = [];
      let count = 0,
        skipped = 0;
      const entity = (kind: Entity["kind"], name: string) => {
        if (!name || name === "Ohne Zuordnung") return "";
        let x = next.entities.find(
          (x) => x.profileId === p.id && x.kind === kind && x.name === name,
        );
        if (!x) {
          x = { id: uid(), profileId: p.id, kind, name };
          next.entities.push(x);
        }
        return x.id;
      };
      for (const [i, row] of rows.entries()) {
        const get = (k: string) => row[map[k]] || "",
          parse = (v: string) =>
            format === "iso"
              ? DateTime.fromISO(v, { zone })
              : DateTime.fromFormat(v, format, { zone });
        const start = parse(get("start")),
          end = parse(get("end"));
        if (!start.isValid || !end.isValid) {
          errors.push(`Zeile ${i + 2}: Beginn oder Ende ungültig.`);
          continue;
        }
        if (row.id && seen.has(row.id)) {
          skipped++;
          continue;
        }
        if (row.id) seen.add(row.id);
        const st = start.toUTC().toISO()!,
          en = end.toUTC().toISO()!;
        if (
          !dupes &&
          next.entries.some((x) => !x.deleted && x.start === st && x.end === en)
        ) {
          skipped++;
          continue;
        }
        const rate = get("rate_eur"),
          cents =
            rate === ""
              ? undefined
              : Math.round(Number(rate.replace(",", ".")) * 100);
        if (
          cents !== undefined &&
          (!Number.isSafeInteger(cents) || cents < 0)
        ) {
          errors.push(`Zeile ${i + 2}: Preis ungültig.`);
          continue;
        }
        const e: Entry = {
          id: uid(),
          profileId: p.id,
          name: get("name"),
          start: st,
          end: en,
          pauses: [],
          tags: get("tags")
            .split("|")
            .filter(Boolean)
            .map((t) => entity("tag", t)),
          categoryId: entity("category", get("category")),
          projectId: entity("project", get("project")),
          customerId: entity("customer", get("customer")),
          rateMode: "none",
          rateCents: cents,
        };
        if (cents !== undefined) {
          const id = entity("rate", "Import " + money(cents) + "/h");
          const r = next.entities.find((x) => x.id === id)!;
          r.cents = cents;
          e.rateId = id;
          e.rateMode = id;
        }
        // Our export contains the full timestamps on every daily slice. Reconstruct total pause once.
        const related = row.id ? rows.filter((x) => x.id === row.id) : [row];
        const deduction = related.reduce(
          (a, x) => a + Number(x.pause_seconds || 0),
          0,
        );
        if (deduction > 0 && deduction < end.diff(start, "seconds").seconds)
          e.pauses = [
            {
              start: start.toUTC().toISO()!,
              end: start.plus({ seconds: deduction }).toUTC().toISO()!,
            },
          ];
        try {
          validateEntry(next, e);
          next.entries.push(e);
          count++;
        } catch (err) {
          errors.push(`Zeile ${i + 2}: ${String(err)}`);
        }
      }
      if (errors.length) throw Error(errors.join("\n"));
      commit(next);
      Rows([]);
      error(`${count} Einträge importiert, ${skipped} Duplikate übersprungen.`);
    });
  }
  return (
    <>
      <section className="card padded">
        <h2>Profile & Erscheinungsbild</h2>
        <div className="settings-row">
          <label>
            Profilname
            <input
              value={p.name}
              onChange={(e) => profile({ name: e.target.value })}
            />
          </label>
          <button
            className="secondary"
            onClick={async () => {
              const name = await prompt("Name des neuen Profils");
              if (name?.trim()) {
                const x: Profile = {
                  id: uid(),
                  name: name.trim(),
                  zone: "Europe/Berlin",
                  plans: [
                    { from: date, seconds: 37 * 3600, days: [1, 2, 3, 4, 5] },
                  ],
                };
                commit({ ...s, profiles: [...s.profiles, x] });
                setPid(x.id);
              }
            }}
          >
            + Neues Profil
          </button>
          <button
            className="text-button danger"
            onClick={() => {
              if (
                s.profiles.filter((x) => !x.archived).length < 2 ||
                s.entries.some(
                  (x) => !x.deleted && !x.end && x.profileId === p.id,
                )
              ) {
                error(
                  "Mindestens ein Profil muss aktiv bleiben. Laufenden Timer zuerst stoppen.",
                );
                return;
              }
              profile({ archived: true });
              setPid(s.profiles.find((x) => !x.archived && x.id !== p.id)!.id);
            }}
          >
            Archivieren
          </button>
        </div>
        <div className="settings-row">
          <label>
            Darstellung
            <Select
              value={s.theme}
              onChange={(e) => commit({ ...s, theme: e.target.value })}
            >
              <option value="system">Systemeinstellung</option>
              <option value="light">Hell</option>
              <option value="dark">Dunkel</option>
            </Select>
          </label>
          <label>
            Standard-Stundensatz
            <Select
              value={p.rateId || ""}
              onChange={(e) => profile({ rateId: e.target.value })}
            >
              <option value="">Ohne Stundensatz</option>
              {rates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Zeitzone
            <input
              key={p.id}
              defaultValue={p.zone}
              onBlur={(e) => {
                if (!DateTime.now().setZone(e.target.value).isValid) {
                  error("Unbekannte Zeitzone.");
                  return;
                }
                profile({ zone: e.target.value });
              }}
            />
          </label>
        </div>
      </section>
      <section className="card padded">
        <h2>Dein Arbeitszeitplan</h2>
        <div className="settings-row">
          <label>
            Arbeitszeitplan für Profil
            <Select value={p.id} onChange={(e) => setPid(e.target.value)}>
              {s.profiles
                .filter((x) => !x.archived)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </Select>
          </label>
        </div>
        <p className="muted">
          Dieser Arbeitszeitplan gilt nur für das Profil „{p.name}“. Neue Pläne
          gelten ab dem gewählten Datum. Frühere Sollwerte bleiben erhalten.
        </p>
        <form
          key={p.id}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget),
              days = fd.getAll("days").map(Number),
              from = String(fd.get("from"));
            if (!days.length) {
              error("Bitte mindestens einen Arbeitstag auswählen.");
              return;
            }
            profile({
              plans: [
                ...p.plans.filter((x) => x.from !== from),
                {
                  from,
                  seconds: Math.round(Number(fd.get("hours")) * 3600),
                  days,
                },
              ],
            });
          }}
        >
          <div className="settings-row">
            <label>
              Wochenstunden
              <input
                name="hours"
                type="number"
                min="0"
                max="168"
                step="0.01"
                defaultValue={latestPlan.seconds / 3600}
                required
              />
            </label>
            <label>
              Gültig ab
              <GermanDateInput name="from" defaultValue={date} required />
            </label>
          </div>
          <div className="weekdays">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d, i) => (
              <label key={d}>
                <input
                  name="days"
                  type="checkbox"
                  value={i + 1}
                  defaultChecked={latestPlan.days.includes(i + 1)}
                />
                <span>{d}</span>
              </label>
            ))}
          </div>
          <button className="primary">Arbeitszeitplan speichern</button>
        </form>
        <div className="plan-list">
          {[...p.plans]
            .sort((a, b) => b.from.localeCompare(a.from))
            .map((x) => (
              <p key={x.from}>
                Ab {germanDate(x.from)}:{" "}
                <strong>{x.seconds / 3600} h / Woche</strong> auf{" "}
                {x.days.length} Tage · {duration(x.seconds / x.days.length)}{" "}
                täglich
              </p>
            ))}
        </div>
      </section>
      <section className="card padded">
        <h2>Import, Export & Datensicherung</h2>
        <p className="muted">
          CSV für Zeiten. JSON sichert alle Profile, Einstellungen und
          historischen Stundensätze.
        </p>
        <div className="settings-row">
          <button
            className="secondary"
            onClick={() =>
              download(
                "tectracker-backup-" + date + ".json",
                JSON.stringify(s, null, 2),
              ).catch((e) => error("Export fehlgeschlagen: " + e))
            }
          >
            ↓ Vollständige Sicherung
          </button>
          <label className="file-button">
            ↑ Sicherung wiederherstellen
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  f.text()
                    .then(async (raw) => {
                      const next = parseBackup(raw);
                      if (
                        !(await confirm(
                          "Alle Daten ersetzen? Vorher wird automatisch eine lokale Sicherung erstellt.",
                        ))
                      )
                        return;
                      await backupBeforeRestore(s);
                      commit(next);
                      setPid(
                        next.profiles.find((x) => !x.archived)?.id ||
                          next.profiles[0].id,
                      );
                    })
                    .catch((e) => error(String(e)));
              }}
            />
          </label>
          <label className="file-button">
            ↑ CSV importieren
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  f.text()
                    .then((raw) => {
                      const parsed = Papa.parse<Record<string, string>>(raw, {
                        header: true,
                        skipEmptyLines: true,
                      });
                      if (parsed.errors.length) {
                        error(parsed.errors[0].message);
                        return;
                      }
                      Rows(parsed.data);
                      Map(
                        Object.fromEntries(
                          [
                            "start",
                            "end",
                            "name",
                            "category",
                            "project",
                            "customer",
                            "tags",
                            "rate_eur",
                          ].map((k) => [
                            k,
                            parsed.meta.fields?.includes(k) ? k : "",
                          ]),
                        ),
                      );
                    })
                    .catch((e) => error(String(e)));
              }}
            />
          </label>
        </div>
      </section>
      {rows.length > 0 && (
        <Modal title="CSV-Import prüfen" onClose={() => Rows([])}>
          <div className="modal wide">
            <h2>CSV-Import prüfen</h2>
            <p>
              {rows.length} Zeilen · Zielprofil: {p.name}
            </p>
            <div className="settings-row">
              <Select
                aria-label="Datumsformat"
                value={format}
                onChange={(e) => Format(e.target.value)}
              >
                <option value="iso">ISO 8601</option>
                <option value="dd.MM.yyyy HH:mm">TT.MM.JJJJ HH:mm</option>
                <option value="yyyy-MM-dd HH:mm:ss">JJJJ-MM-TT HH:mm:ss</option>
              </Select>
              <input
                aria-label="Import-Zeitzone"
                value={zone}
                onChange={(e) => Zone(e.target.value)}
              />
            </div>
            <div className="mapping">
              {Object.keys(map).map((k) => (
                <label key={k}>
                  {k}
                  <Select
                    value={map[k]}
                    onChange={(e) => Map({ ...map, [k]: e.target.value })}
                  >
                    <option value="">Nicht zuordnen</option>
                    {Object.keys(rows[0]).map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
            <pre>{JSON.stringify(rows.slice(0, 3), null, 2)}</pre>
            <label className="check">
              <input
                type="checkbox"
                checked={dupes}
                onChange={(e) => Dupes(e.target.checked)}
              />
              Duplikate übernehmen (Überschneidungen bleiben unzulässig)
            </label>
            <div className="modal-actions">
              <button className="secondary" onClick={() => Rows([])}>
                Abbrechen
              </button>
              <button className="primary" onClick={importCsv}>
                Importieren
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
