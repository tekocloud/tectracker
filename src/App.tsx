import Select from "./Select";
import Modal from "./Modal";
import { useDialogs } from "./Dialogs";
import { useEffect, useState, useRef } from "react";
import { version } from "../package.json";
import PauseEditor from "./PauseEditor";
import AbsenceSummary, { AbsenceTimelineRow } from "./AbsenceSummary";
import GermanDateInput, { germanDate } from "./GermanDateInput";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DateTime } from "luxon";
import Papa from "papaparse";
import {
  Clock3,
  BarChart3,
  List,
  Settings,
  Layers,
  Play,
  Square,
  Pause,
  Plus,
  Download,
  Upload,
  Briefcase,
} from "lucide-react";
import {
  initial,
  uid,
  today,
  duration,
  money,
  target,
  scheduledTarget,
  slices,
  resolveRate,
  validateEntry,
  type State,
  type Entry,
  type Entity,
  type Day,
} from "./core";
import { load, save, download, parseBackup } from "./storage";
const labels = {
  category: "Kategorien",
  tag: "Tags",
  project: "Projekte",
  customer: "Kunden",
  rate: "Stundensätze",
};
const blank = () => ({
  name: "",
  categoryId: "",
  projectId: "",
  customerId: "",
  tags: [] as string[],
  rateMode: "auto",
});
export default function App() {
  const { confirm, prompt } = useDialogs();
  const [s, S] = useState<State>(initial),
    [ready, R] = useState(false),
    [pid, P] = useState(""),
    [page, Page] = useState("Zeiterfassung"),
    [error, E] = useState(""),
    [tick, T] = useState(Date.now()),
    [draft, D] = useState(blank),
    [details, Details] = useState(false),
    [edit, Edit] = useState<Entry | null>(null),
    [recordKind, RecordKind] = useState("Arbeitszeit"),
    [absenceDate, AbsenceDate] = useState(today()),
    [kind, K] = useState<Entity["kind"]>("category"),
    [range, Range] = useState("week"),
    [from, From] = useState(today()),
    [to, To] = useState(today()),
    [filter, F] = useState(""),
    [all, All] = useState(false),
    [group, G] = useState("categoryId"),
    [unit, U] = useState("hours");
  useEffect(() => {
    load()
      .then((x) => {
        S(x);
        P(x.profiles.find((p) => !p.archived)?.id || x.profiles[0].id);
        R(true);
      })
      .catch((e) => E(String(e)));
    const id = setInterval(() => T(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
  }, [s.theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, pid]);
  const p = s.profiles.find((x) => x.id === pid) || s.profiles[0],
    date = today(p.zone),
    now = DateTime.now().setZone("Europe/Berlin"),
    active = s.entries.find((x) => !x.deleted && !x.end),
    running = active?.profileId === p.id ? active : undefined,
    paused = !!running?.pauses.some((x) => !x.end),
    form = running || draft;
  const trayAction = useRef(() => {});
  useEffect(() => {
    E("");
    RecordKind("Arbeitszeit");
    if (edit)
      AbsenceDate(
        DateTime.fromISO(edit.start)
          .setZone(
            s.profiles.find((x) => x.id === edit.profileId)?.zone || p.zone,
          )
          .toISODate()!,
      );
  }, [edit?.id]);
  function newEntry() {
    Edit({
      id: uid(),
      profileId: p.id,
      name: "",
      start: now.minus({ hours: 1 }).toUTC().toISO()!,
      end: now.toUTC().toISO()!,
      pauses: [],
      tags: [],
      rateMode: "auto",
      ...resolveRate(s, p, { rateMode: "auto" }),
    });
  }
  trayAction.current = () => {
    if (active) {
      const time = new Date().toISOString();
      commit({
        ...s,
        entries: s.entries.map((x) =>
          x.id === active.id
            ? {
                ...x,
                end: time,
                pauses: x.pauses.map((b) => (b.end ? b : { ...b, end: time })),
              }
            : x,
        ),
      });
    } else start();
  };
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let off: (() => void) | undefined;
    listen("timer-toggle", () => trayAction.current()).then((fn) => {
      if (disposed) fn();
      else off = fn;
    });
    return () => {
      disposed = true;
      off?.();
    };
  }, []);
  function commit(next: State) {
    next = {
      ...next,
      revision: s.revision + 1,
      journal: [
        ...s.journal,
        { id: uid(), at: new Date().toISOString(), revision: s.revision + 1 },
      ],
    };
    S(next);
    save(next).catch((e) => E("Speichern fehlgeschlagen: " + e));
  }
  function attempt(fn: () => void) {
    try {
      E("");
      fn();
    } catch (e) {
      E(e instanceof Error ? e.message : String(e));
    }
  }
  function update(patch: Partial<ReturnType<typeof blank>>) {
    if (running) {
      const e = { ...running, ...patch };
      commit({
        ...s,
        entries: s.entries.map((x) =>
          x.id === e.id
            ? {
                ...e,
                ...(patch.rateMode !== undefined ||
                (e.rateMode === "auto" &&
                  (patch.projectId !== undefined ||
                    patch.customerId !== undefined))
                  ? resolveRate(s, p, e)
                  : {}),
              }
            : x,
        ),
      });
    } else D((x) => ({ ...x, ...patch }));
  }
  async function start(template?: Entry) {
    if (
      active &&
      !(await confirm("Laufenden Timer stoppen und einen neuen starten?"))
    )
      return;
    attempt(() => {
      const time = new Date().toISOString();
      const fields = template
        ? {
            name: template.name,
            categoryId: template.categoryId,
            projectId: template.projectId,
            customerId: template.customerId,
            tags: template.tags,
            rateMode: template.rateMode,
          }
        : draft;
      const e: Entry = {
        ...fields,
        id: uid(),
        profileId: p.id,
        start: time,
        pauses: [],
        ...resolveRate(s, p, fields),
      };
      const entries = s.entries.map((x) =>
        x.id === active?.id
          ? {
              ...x,
              end: time,
              pauses: x.pauses.map((b) => (b.end ? b : { ...b, end: time })),
            }
          : x,
      );
      validateEntry({ ...s, entries }, e);
      commit({ ...s, entries: [...entries, e] });
      D(blank());
    });
  }
  function stop() {
    if (!running) return;
    const time = new Date().toISOString();
    commit({
      ...s,
      entries: s.entries.map((x) =>
        x.id === running.id
          ? {
              ...x,
              end: time,
              pauses: x.pauses.map((b) => (b.end ? b : { ...b, end: time })),
            }
          : x,
      ),
    });
  }
  function pause() {
    if (!running) return;
    const time = new Date().toISOString(),
      e = {
        ...running,
        pauses: paused
          ? running.pauses.map((x) => (x.end ? x : { ...x, end: time }))
          : [...running.pauses, { start: time }],
      };
    attempt(() => {
      validateEntry(s, e);
      commit({ ...s, entries: s.entries.map((x) => (x.id === e.id ? e : x)) });
    });
  }
  const rows = slices(s, tick),
    daily = rows.filter((x) => x.entry.profileId === p.id && x.date === date),
    net = daily.reduce((a, x) => a + x.net, 0),
    value = daily.reduce((a, x) => a + x.cents, 0),
    goal = target(p, date, s.days),
    day = s.days.find((x) => x.profileId === p.id && x.date === date) || {
      profileId: p.id,
      date,
      actual: 0,
      planned: 0,
      absence: "",
    };
  function changeDay(patch: Partial<Day>) {
    const d = { ...day, ...patch };
    if (d.actual > daily.reduce((a, x) => a + x.gross, 0)) {
      E("Die Pause darf die erfasste Zeit nicht überschreiten.");
      return;
    }
    commit({
      ...s,
      days: [
        ...s.days.filter((x) => !(x.profileId === p.id && x.date === date)),
        d,
      ],
    });
  }
  const entities = (k: Entity["kind"]) =>
      s.entities.filter(
        (x) => x.profileId === p.id && x.kind === k && !x.archived,
      ),
    name = (id?: string) =>
      s.entities.find((x) => x.id === id)?.name || "Ohne Zuordnung";
  const select = (
    k: Entity["kind"],
    v: string | undefined,
    change: (v: string) => void,
  ) => (
    <Select
      aria-label={labels[k]}
      value={v || ""}
      onChange={(e) => change(e.target.value)}
    >
      <option value="">{labels[k]} wählen</option>
      {entities(k).map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
    </Select>
  );
  const rates = (v: string, change: (v: string) => void) => (
    <Select
      aria-label="Stundensatz"
      value={v}
      onChange={(e) => change(e.target.value)}
    >
      <option value="auto">Stundensatz automatisch</option>
      <option value="none">Ohne Stundensatz</option>
      {entities("rate").map((x) => (
        <option key={x.id} value={x.id}>
          {x.name} · {money(x.cents || 0)}/h
        </option>
      ))}
    </Select>
  );
  let a = from,
    b = to;
  if (range !== "custom") {
    const u =
      range === "day"
        ? "day"
        : range === "month"
          ? "month"
          : range === "year"
            ? "year"
            : "week";
    a = now.startOf(u).toISODate()!;
    b = now.endOf(u).toISODate()!;
  }
  const report = rows.filter(
      (x) =>
        (all || x.entry.profileId === p.id) &&
        x.date >= a &&
        x.date <= b &&
        (!filter ||
          [
            x.entry.categoryId,
            x.entry.projectId,
            x.entry.customerId,
            x.entry.rateId,
            ...x.entry.tags,
          ].includes(filter)),
    ),
    total = report.reduce((a, x) => a + x.net, 0),
    amount = report.reduce((a, x) => a + x.cents, 0);
  const absences = s.days.filter(
    (d) =>
      d.absence && (all || d.profileId === p.id) && d.date >= a && d.date <= b,
  );
  async function removeAbsence(day: Day) {
    if (await confirm(`${day.absence} am ${germanDate(day.date)} entfernen?`))
      commit({
        ...s,
        days: s.days.map((d) =>
          d.profileId === day.profileId && d.date === day.date
            ? { ...d, absence: "" }
            : d,
        ),
      });
  }
  const chartTotals = report.reduce<Record<string, number>>((acc, x) => {
    acc[x.date] =
      (acc[x.date] || 0) + (unit === "hours" ? x.net / 3600 : x.cents / 100);
    return acc;
  }, {});
  const chartMax = Math.max(1, ...Object.values(chartTotals));
  let reportGoal = 0,
    regularGoal = 0,
    elapsedGoal = 0;
  for (
    let d = DateTime.fromISO(a), end = DateTime.fromISO(b);
    d <= end;
    d = d.plus({ days: 1 })
  )
    for (const profile of s.profiles.filter((x) => all || x.id === p.id)) {
      const date = d.toISODate()!,
        scheduled = scheduledTarget(profile, date);
      regularGoal += scheduled;
      if (
        !s.days.some(
          (day) =>
            day.profileId === profile.id && day.date === date && day.absence,
        )
      )
        reportGoal += scheduled;
      elapsedGoal += target(profile, date, s.days);
    }
  function csvExport() {
    download(
      "tectracker.csv",
      Papa.unparse(
        report.map((x) => ({
          id: x.entry.id,
          profile: s.profiles.find((p) => p.id === x.entry.profileId)?.name,
          date: x.date,
          name: x.entry.name,
          start: x.entry.start,
          end: x.entry.end || "",
          category: name(x.entry.categoryId),
          project: name(x.entry.projectId),
          customer: name(x.entry.customerId),
          tags: x.entry.tags.map(name).join("|"),
          gross_seconds: x.gross,
          pause_seconds: x.gross - x.net,
          net_seconds: x.net,
          rate_eur:
            x.entry.rateCents === undefined ? "" : x.entry.rateCents / 100,
          amount_eur: x.cents / 100,
        })),
      ),
      "text/csv;charset=utf-8",
    ).catch((e) => E("Export fehlgeschlagen: " + e));
  }
  function entryList(entries: Entry[]) {
    return entries.length ? (
      <div>
        {entries.map((e) => {
          const rr = rows.filter((x) => x.entry.id === e.id);
          return (
            <div className="entry" key={e.id}>
              <span className="color-dot" />
              <div className="entry-title">
                <strong>{e.name || "Ohne Beschreibung"}</strong>
                <small>
                  {[
                    e.projectId && name(e.projectId),
                    e.categoryId && name(e.categoryId),
                    e.customerId && name(e.customerId),
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Keine Zuordnung"}{" "}
                  {e.tags.map((id) => (
                    <span className="tag" key={id}>
                      {name(id)}
                    </span>
                  ))}
                </small>
              </div>
              <div className="entry-time">
                {DateTime.fromISO(e.start)
                  .setZone("Europe/Berlin")
                  .toFormat("HH:mm")}{" "}
                –{" "}
                {e.end
                  ? DateTime.fromISO(e.end)
                      .setZone("Europe/Berlin")
                      .toFormat("HH:mm")
                  : "läuft"}
                <small>
                  {e.rateCents === undefined
                    ? "Ohne Stundensatz"
                    : money(e.rateCents) + "/h"}
                </small>
              </div>
              <div className="entry-total">
                <strong>{duration(rr.reduce((a, x) => a + x.net, 0))}</strong>
                <small>{money(rr.reduce((a, x) => a + x.cents, 0))}</small>
              </div>
              <button
                title="Bearbeiten"
                className="icon"
                onClick={() => Edit(structuredClone(e))}
              >
                ✎
              </button>
              <button
                title="Erneut starten"
                className="icon"
                onClick={() => start(e)}
              >
                <Play size={15} />
              </button>
              <button
                title="Löschen"
                className="icon danger"
                onClick={async () => {
                  if (await confirm("Eintrag löschen?"))
                    commit({
                      ...s,
                      entries: s.entries.map((x) =>
                        x.id === e.id ? { ...x, deleted: true } : x,
                      ),
                    });
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="empty">
        <Clock3 size={34} />
        <h3>Platz für deinen Arbeitstag</h3>
        <p>Starte den Timer oder trage eine Zeit manuell nach.</p>
      </div>
    );
  }
  if (!ready)
    return (
      <div className="loading">{error || "TecTracker wird geladen …"}</div>
    );
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <img className="logo" src="/logo.png" alt="TecTracker Logo" />
          Tec<span>Tracker</span>
        </div>
        <div className="workspace-label">DEIN ARBEITSBEREICH</div>
        <div className="profile">
          <Briefcase size={18} />
          <Select
            aria-label="Profil"
            value={p.id}
            onChange={(e) => {
              P(e.target.value);
              D(blank());
            }}
          >
            {s.profiles
              .filter((x) => !x.archived)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </Select>
        </div>
        <nav>
          {[
            [Clock3, "Zeiterfassung"],
            [List, "Verlauf"],
            [BarChart3, "Statistik"],
            [Layers, "Stammdaten"],
            [Settings, "Einstellungen"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Clock3;
            return (
              <button
                key={String(label)}
                className={page === label ? "active" : ""}
                onClick={() => Page(String(label))}
              >
                <I size={20} />
                {String(label)}
                {page === label && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="local">
            <span /> Lokal gespeichert
          </div>
          <p>Deine Zeit. Deine Daten.</p>
          <small>TecTracker · {version}</small>
        </div>
      </aside>
      <main key={page + pid}>
        <header>
          <div>
            <div className="eyebrow">
              {p.name} <span>/</span> {page}
            </div>
            <h1>{page}</h1>
            <p>
              {page === "Zeiterfassung"
                ? "Konzentriere dich auf deine Arbeit. Wir behalten die Zeit im Blick."
                : "Deine Zeit und ihr Wert – übersichtlich organisiert."}
            </p>
          </div>
          <div className="header-date">
            {now.setLocale("de").toFormat("cccc, dd. MMMM yyyy")}
            <span className="avatar">{p.name.slice(0, 2).toUpperCase()}</span>
          </div>
        </header>
        {error && (
          <div role="alert" className="alert">
            {error}
            <button onClick={() => E("")}>×</button>
          </div>
        )}
        {active && active.profileId !== p.id && (
          <div className="notice">
            Timer läuft in{" "}
            {s.profiles.find((x) => x.id === active.profileId)?.name}.{" "}
            <button onClick={() => P(active.profileId)}>Zum Timer</button>
          </div>
        )}
        {page === "Zeiterfassung" && (
          <>
            <section
              className={"card timer-card " + (running ? "is-running" : "")}
            >
              <div className="section-label">
                <span className={running ? "status-dot live" : "status-dot"} />
                {running
                  ? paused
                    ? "PAUSIERT"
                    : "ZEIT WIRD ERFASST"
                  : "BEREIT, WENN DU ES BIST"}
              </div>
              <div className="timer-main">
                <input
                  className="task-input"
                  placeholder="Woran arbeitest du gerade?"
                  aria-label="Beschreibung"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
                <div className="timer-digits">
                  {duration(
                    running
                      ? rows
                          .filter((x) => x.entry.id === running.id)
                          .reduce((a, x) => a + x.gross - x.pause, 0)
                      : 0,
                  )}
                </div>
                {running ? (
                  <>
                    <button
                      className="secondary"
                      title="Pause / Fortsetzen"
                      onClick={pause}
                    >
                      {paused ? <Play size={18} /> : <Pause size={18} />}
                    </button>
                    <button className="stop" onClick={stop}>
                      <Square size={17} fill="currentColor" />
                      Stopp
                    </button>
                  </>
                ) : (
                  <button className="primary" onClick={() => start()}>
                    <Play size={18} fill="currentColor" />
                    Start
                  </button>
                )}
              </div>
              <div className="timer-fields">
                {select("project", form.projectId, (v) =>
                  update({
                    projectId: v,
                    customerId:
                      s.entities.find((x) => x.id === v)?.customerId || "",
                  }),
                )}
                {select("category", form.categoryId, (v) =>
                  update({ categoryId: v }),
                )}
                {rates(form.rateMode, (v) => update({ rateMode: v }))}
                <button
                  className="text-button"
                  onClick={() => Details(!details)}
                >
                  <Plus size={15} />
                  Weitere Details
                </button>
              </div>
              {details && (
                <div className="details">
                  {select("customer", form.customerId, (v) =>
                    update({ customerId: v }),
                  )}
                  <div className="tag-options">
                    {entities("tag").map((t) => (
                      <label key={t.id}>
                        <input
                          type="checkbox"
                          checked={form.tags.includes(t.id)}
                          onChange={(e) =>
                            update({
                              tags: e.target.checked
                                ? [...form.tags, t.id]
                                : form.tags.filter((x) => x !== t.id),
                            })
                          }
                        />
                        {t.name}
                      </label>
                    ))}
                    {!entities("tag").length && (
                      <small>Tags unter Stammdaten anlegen.</small>
                    )}
                  </div>
                </div>
              )}
            </section>
            <div className="metrics">
              <Metric
                title="HEUTE ERFASST"
                value={duration(net)}
                sub={"von " + duration(goal) + " Sollzeit"}
              />
              <Metric
                title="ZEITSALDO"
                value={(net >= goal ? "+" : "") + duration(net - goal)}
                sub="gegenüber deinem Tagesziel"
              />
              <Metric
                title="PAUSEN"
                value={duration(
                  Math.max(
                    day.actual,
                    daily.reduce((a, x) => a + x.pause, 0),
                  ),
                )}
                sub={Math.round(day.planned / 60) + " Min. noch geplant"}
              />
              <Metric
                title="ZEITWERT HEUTE"
                value={money(value)}
                sub="auf Basis deiner Stundensätze"
                accent
              />
            </div>
            <section className="card progress-card">
              <div>
                <strong>Dein Tagesfortschritt</strong>
                <span>
                  {goal ? Math.min(100, Math.round((net / goal) * 100)) : 0}%
                </span>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${goal ? Math.min(100, (net / goal) * 100) : 0}%`,
                  }}
                />
              </div>
              <small>
                {net >= goal
                  ? "Tagesziel erreicht"
                  : duration(Math.max(0, goal - net)) + " bis zum Tagesziel"}
                <span>
                  Voraussichtlicher Feierabend:{" "}
                  {now
                    .plus({ seconds: Math.max(0, goal - net) + day.planned })
                    .toFormat("HH:mm")}{" "}
                  Uhr
                </span>
              </small>
            </section>
            <div className="section-heading">
              <h2>
                Deine Zeiteinträge <span>Heute</span>
              </h2>
              <button
                className="secondary"
                onClick={() =>
                  Edit({
                    id: uid(),
                    profileId: p.id,
                    name: "",
                    start: now.minus({ hours: 1 }).toUTC().toISO()!,
                    end: now.toUTC().toISO()!,
                    pauses: [],
                    tags: [],
                    rateMode: "auto",
                    ...resolveRate(s, p, { rateMode: "auto" }),
                  })
                }
              >
                <Plus size={16} />
                Zeit nachtragen
              </button>
            </div>
            <section className="card">
              <div className="day-heading">
                <strong>
                  {now.setLocale("de").toFormat("cccc, dd. MMMM")}
                </strong>
                <span>
                  {duration(net)} · {money(value)}
                </span>
              </div>
              {entryList(
                s.entries
                  .filter(
                    (e) =>
                      !e.deleted &&
                      e.profileId === p.id &&
                      daily.some((x) => x.entry.id === e.id),
                  )
                  .sort((a, b) => b.start.localeCompare(a.start)),
              )}
            </section>
            <section className="card day-settings">
              <div>
                <h3>Pausen & Abwesenheit</h3>
                <p>Timerpausen werden nicht doppelt abgezogen.</p>
              </div>
              <label>
                Pause gesamt (Min.)
                <input
                  type="number"
                  min="0"
                  value={day.actual / 60}
                  onChange={(e) =>
                    changeDay({
                      actual: Math.max(0, Number(e.target.value)) * 60,
                    })
                  }
                />
              </label>
              <label>
                Noch geplant (Min.)
                <input
                  type="number"
                  min="0"
                  value={day.planned / 60}
                  onChange={(e) =>
                    changeDay({
                      planned: Math.max(0, Number(e.target.value)) * 60,
                    })
                  }
                />
              </label>
              <label>
                Heute
                <Select
                  value={day.absence}
                  onChange={(e) => changeDay({ absence: e.target.value })}
                >
                  <option value="">Arbeitstag</option>
                  <option>Urlaub</option>
                  <option>Krankheit</option>
                  <option>Frei</option>
                </Select>
              </label>
            </section>
          </>
        )}
        {(page === "Statistik" || page === "Verlauf") && (
          <>
            <section className="card filters">
              <Select value={range} onChange={(e) => Range(e.target.value)}>
                <option value="day">Heute</option>
                <option value="week">Diese Woche</option>
                <option value="month">Dieser Monat</option>
                <option value="year">Dieses Jahr</option>
                <option value="custom">Eigener Zeitraum</option>
              </Select>
              {range === "custom" && (
                <>
                  <GermanDateInput
                    aria-label="Von"
                    value={from}
                    onValueChange={From}
                  />
                  <GermanDateInput
                    aria-label="Bis"
                    value={to}
                    onValueChange={To}
                  />
                </>
              )}
              <Select value={filter} onChange={(e) => F(e.target.value)}>
                <option value="">Alle Zuordnungen</option>
                {s.entities
                  .filter((x) => all || x.profileId === p.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {labels[x.kind]}: {x.name}
                    </option>
                  ))}
              </Select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={(e) => All(e.target.checked)}
                />
                Alle Profile
              </label>
              <button className="secondary" onClick={newEntry}>
                <Plus size={16} />
                Zeit nachtragen
              </button>
              <button className="secondary" onClick={csvExport}>
                <Download size={16} />
                CSV exportieren
              </button>
            </section>
            <div className="metrics">
              <Metric
                title="NETTOARBEITSZEIT"
                value={duration(total)}
                sub={
                  report.some((x) => !x.entry.end)
                    ? "inkl. vorläufiger laufender Zeiten"
                    : "im gewählten Zeitraum"
                }
              />
              <Metric
                title="SOLLZEIT"
                value={duration(reportGoal)}
                sub={duration(total - elapsedGoal) + " Saldo bis heute"}
              />
              <Metric
                title="OHNE STUNDENSATZ"
                value={duration(
                  report
                    .filter((x) => x.entry.rateCents === undefined)
                    .reduce((a, x) => a + x.net, 0),
                )}
                sub={
                  duration(
                    report
                      .filter((x) => x.entry.rateCents !== undefined)
                      .reduce((a, x) => a + x.net, 0),
                  ) + " bewertet"
                }
              />
              <Metric
                title="GESAMTER ZEITWERT"
                value={money(amount)}
                sub="EUR · ohne Umsatzsteuer"
                accent
              />
            </div>
            {regularGoal !== reportGoal && (
              <p className="goal-adjustment">
                Reguläre Sollzeit <strong>{duration(regularGoal)}</strong> −{" "}
                <strong>{duration(regularGoal - reportGoal)}</strong> Urlaub /
                Krankheit / Frei = <strong>{duration(reportGoal)}</strong>{" "}
                verbleibende Sollzeit
              </p>
            )}
            {page === "Statistik" && (
              <AbsenceSummary
                state={s}
                days={absences}
                onRemove={removeAbsence}
              />
            )}
            {page === "Statistik" && (
              <>
                <section className="card padded">
                  <h2>Soll &amp; Ist</h2>
                  <div className="compare">
                    {[
                      ["Soll", reportGoal],
                      ["Ist", total],
                    ].map(([label, v]) => (
                      <div key={String(label)}>
                        <span>{label}</span>
                        <div className="progress">
                          <i
                            style={{
                              width:
                                (Number(v) / Math.max(1, total, reportGoal)) *
                                  100 +
                                "%",
                            }}
                          />
                        </div>
                        <strong>{duration(Number(v))}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="muted">
                    Tatsächliche Pausen:{" "}
                    {duration(report.reduce((n, x) => n + x.gross - x.net, 0))}{" "}
                    · Sollzeit gilt für das gesamte Profil, unabhängig vom
                    Zuordnungsfilter.
                  </p>
                </section>
                <section className="card chart">
                  <div className="section-heading">
                    <h2>Arbeitszeit im Verlauf</h2>
                    <Select value={unit} onChange={(e) => U(e.target.value)}>
                      <option value="hours">Stunden</option>
                      <option value="money">Euro</option>
                    </Select>
                  </div>
                  <div className="bars">
                    {Array.from(
                      {
                        length: Math.min(
                          366,
                          Math.max(
                            1,
                            Math.round(
                              DateTime.fromISO(b).diff(
                                DateTime.fromISO(a),
                                "days",
                              ).days,
                            ) + 1,
                          ),
                        ),
                      },
                      (_, i) =>
                        DateTime.fromISO(a).plus({ days: i }).toISODate()!,
                    ).map((d) => {
                      const v = chartTotals[d] || 0,
                        max = chartMax;
                      return (
                        <div
                          key={d}
                          className="bar-col"
                          title={`${germanDate(d)}: ${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit === "hours" ? "h" : "EUR"}`}
                        >
                          <div
                            className="bar"
                            style={{ height: Math.max(2, (v / max) * 160) }}
                          />
                          <small>{DateTime.fromISO(d).toFormat("dd.MM")}</small>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chart-footer">
                    {germanDate(a)} — {germanDate(b)} ·{" "}
                    {unit === "hours"
                      ? "Nettozeit in Stunden"
                      : "Zeitwert in EUR"}
                  </div>
                </section>
                <section className="card">
                  <div className="table-heading">
                    <h2>Verteilung deiner Zeit</h2>
                    <Select value={group} onChange={(e) => G(e.target.value)}>
                      <option value="categoryId">Kategorie</option>
                      <option value="projectId">Projekt</option>
                      <option value="customerId">Kunde</option>
                      <option value="tags">Tags</option>
                      <option value="rateId">Stundensatz</option>
                      <option value="date">Tag</option>
                    </Select>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Zuordnung</th>
                        <th>Verteilung</th>
                        <th>Nettozeit</th>
                        <th>Zeitwert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(
                        report.reduce<
                          Record<string, { net: number; cents: number }>
                        >((acc, x) => {
                          const keys =
                            group === "date"
                              ? [x.date]
                              : group === "tags"
                                ? x.entry.tags.length
                                  ? x.entry.tags
                                  : [""]
                                : [String(x.entry[group as keyof Entry] || "")];
                          for (const k of keys) {
                            acc[k] ??= { net: 0, cents: 0 };
                            acc[k].net += x.net;
                            acc[k].cents += x.cents;
                          }
                          return acc;
                        }, {}),
                      )
                        .sort((a, b) => b[1].net - a[1].net)
                        .map(([id, v]) => (
                          <tr key={id}>
                            <td>
                              <span className="color-dot" />
                              {group === "date" ? germanDate(id) : name(id)}
                            </td>
                            <td>
                              <div className="mini-progress">
                                <i
                                  style={{
                                    width: `${(v.net / Math.max(1, total)) * 100}%`,
                                  }}
                                />
                              </div>
                            </td>
                            <td>{duration(v.net)}</td>
                            <td>
                              <strong>{money(v.cents)}</strong>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!report.length && (
                    <div className="empty">
                      Noch keine Daten für diesen Zeitraum.
                    </div>
                  )}
                  {group === "tags" && (
                    <p className="muted padded">
                      Tags können sich überlappen. Ihre Summen lassen sich nicht
                      zur Gesamtsumme addieren.
                    </p>
                  )}
                </section>
              </>
            )}
            {page === "Verlauf" &&
              Array.from(
                new Set([
                  ...report.map((x) => x.date),
                  ...absences.map((x) => x.date),
                ]),
              )
                .sort()
                .reverse()
                .map((d) => (
                  <section className="card history-day" key={d}>
                    <div className="day-heading">
                      <strong>{germanDate(d)}</strong>
                      <span>
                        {!report.some((x) => x.date === d) ? (
                          <>
                            {duration(
                              absences
                                .filter((x) => x.date === d)
                                .reduce(
                                  (n, day) =>
                                    n +
                                    scheduledTarget(
                                      s.profiles.find(
                                        (p) => p.id === day.profileId,
                                      )!,
                                      d,
                                    ),
                                  0,
                                ),
                            )}{" "}
                            Sollzeit entfällt
                          </>
                        ) : (
                          <>
                            {duration(
                              report
                                .filter((x) => x.date === d)
                                .reduce((a, x) => a + x.net, 0),
                            )}{" "}
                            ·{" "}
                            {money(
                              report
                                .filter((x) => x.date === d)
                                .reduce((a, x) => a + x.cents, 0),
                            )}
                          </>
                        )}
                      </span>
                    </div>
                    {absences
                      .filter((day) => day.date === d)
                      .map((day) => (
                        <AbsenceTimelineRow
                          key={day.profileId + day.date}
                          state={s}
                          day={day}
                          onRemove={removeAbsence}
                        />
                      ))}
                    {report.some((x) => x.date === d) &&
                      entryList([
                        ...new Map(
                          report
                            .filter((x) => x.date === d)
                            .map((x) => [x.entry.id, x.entry]),
                        ).values(),
                      ])}
                  </section>
                ))}
          </>
        )}
        {page === "Stammdaten" && (
          <>
            <div className="tabs">
              {Object.entries(labels).map(([k, v]) => (
                <button
                  className={kind === k ? "selected" : ""}
                  key={k}
                  onClick={() => K(k as Entity["kind"])}
                >
                  {v}
                </button>
              ))}
            </div>
            <section className="card padded">
              <h2>{labels[kind]}</h2>
              <form
                className="entity-form"
                key={kind}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget),
                    n = String(fd.get("name")).trim();
                  if (!n) return;
                  commit({
                    ...s,
                    entities: [
                      ...s.entities,
                      {
                        id: uid(),
                        name: n,
                        profileId: p.id,
                        kind,
                        ...(kind === "rate"
                          ? { cents: Math.round(Number(fd.get("price")) * 100) }
                          : {}),
                        rateId: String(fd.get("rate") || ""),
                        customerId: String(fd.get("customer") || ""),
                      },
                    ],
                  });
                  e.currentTarget.reset();
                }}
              >
                <input
                  name="name"
                  placeholder="Bezeichnung"
                  required
                  maxLength={160}
                />
                {kind === "rate" && (
                  <input
                    aria-label="Euro pro Stunde"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="EUR / Stunde"
                    required
                  />
                )}
                {(kind === "project" || kind === "customer") && (
                  <Select name="rate">
                    <option value="">Kein eigener Standardsatz</option>
                    {entities("rate").map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                )}
                {kind === "project" && (
                  <Select name="customer">
                    <option value="">Kein Kunde</option>
                    {entities("customer").map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                )}
                <button className="primary">
                  <Plus size={16} />
                  Anlegen
                </button>
              </form>
              {entities(kind).map((x) => (
                <div className="master-row" key={x.id}>
                  <strong>{x.name}</strong>
                  <span>
                    {kind === "rate"
                      ? money(x.cents || 0) + "/h"
                      : x.customerId
                        ? name(x.customerId)
                        : ""}
                  </span>
                  <button
                    className="icon"
                    title="Bearbeiten"
                    onClick={async () => {
                      const n = await prompt("Bezeichnung", x.name);
                      if (!n?.trim()) return;
                      let cents = x.cents;
                      if (kind === "rate") {
                        const v = await prompt(
                          "EUR pro Stunde",
                          String((cents || 0) / 100),
                        );
                        if (v === null) return;
                        cents = Math.round(Number(v.replace(",", ".")) * 100);
                        if (!Number.isFinite(cents) || cents < 0) {
                          E("Ungültiger Stundensatz.");
                          return;
                        }
                      }
                      let rateId = x.rateId,
                        customerId = x.customerId;
                      if (kind === "project" || kind === "customer") {
                        const choice = await prompt(
                          "Standard-Stundensatz: Name oder leer für Vererbung",
                          name(rateId) === "Ohne Zuordnung" ? "" : name(rateId),
                        );
                        if (choice === null) return;
                        const r = entities("rate").find(
                          (r) => r.name === choice,
                        );
                        if (choice && !r) {
                          E("Stundensatz nicht gefunden.");
                          return;
                        }
                        rateId = r?.id;
                        if (kind === "project") {
                          const c = await prompt(
                            "Kunde: Name oder leer",
                            name(customerId) === "Ohne Zuordnung"
                              ? ""
                              : name(customerId),
                          );
                          if (c === null) return;
                          const customer = entities("customer").find(
                            (v) => v.name === c,
                          );
                          if (c && !customer) {
                            E("Kunde nicht gefunden.");
                            return;
                          }
                          customerId = customer?.id;
                        }
                      }
                      commit({
                        ...s,
                        entities: s.entities.map((y) =>
                          y.id === x.id
                            ? {
                                ...y,
                                name: n.trim(),
                                cents,
                                rateId,
                                customerId,
                              }
                            : y,
                        ),
                      });
                    }}
                  >
                    ✎
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      commit({
                        ...s,
                        entities: s.entities.map((y) =>
                          y.id === x.id ? { ...y, archived: true } : y,
                        ),
                      })
                    }
                  >
                    Archivieren
                  </button>
                </div>
              ))}
              {!entities(kind).length && (
                <div className="empty">Noch keine {labels[kind]} angelegt.</div>
              )}
            </section>
          </>
        )}
        {page === "Einstellungen" && (
          <SettingsPanel
            s={s}
            p={p}
            date={date}
            commit={commit}
            setPid={P}
            error={E}
            attempt={attempt}
          />
        )}
        <footer>
          <span>
            <span className="status-dot" />
            Offline verfügbar · Daten bleiben auf diesem Gerät
          </span>
          <span>TecTracker ↗</span>
        </footer>
      </main>
      {edit && (
        <Modal
          title={
            s.entries.some((x) => x.id === edit.id)
              ? "Zeiteintrag bearbeiten"
              : "Zeit nachtragen"
          }
          onClose={() => Edit(null)}
        >
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              attempt(() => {
                if (recordKind !== "Arbeitszeit") {
                  if (!DateTime.fromISO(absenceDate).isValid)
                    throw Error("Bitte ein gültiges Abwesenheitsdatum wählen.");
                  const old = s.days.find(
                    (d) =>
                      d.profileId === edit.profileId && d.date === absenceDate,
                  );
                  commit({
                    ...s,
                    days: [
                      ...s.days.filter(
                        (d) =>
                          !(
                            d.profileId === edit.profileId &&
                            d.date === absenceDate
                          ),
                      ),
                      {
                        profileId: edit.profileId,
                        date: absenceDate,
                        actual: old?.actual || 0,
                        planned: old?.planned || 0,
                        absence: recordKind,
                      },
                    ],
                  });
                  Edit(null);
                  return;
                }
                const updated = {
                  ...edit,
                  pauses: [...edit.pauses].sort(
                    (a, b) => Date.parse(a.start) - Date.parse(b.start),
                  ),
                };
                validateEntry(s, updated);
                commit({
                  ...s,
                  entries: s.entries.some((x) => x.id === edit.id)
                    ? s.entries.map((x) => (x.id === edit.id ? updated : x))
                    : [...s.entries, updated],
                });
                Edit(null);
              });
            }}
          >
            <h2 id="edit-heading">
              {s.entries.some((x) => x.id === edit.id)
                ? "Zeiteintrag bearbeiten"
                : "Zeit nachtragen"}
            </h2>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            {!s.entries.some((x) => x.id === edit.id) && (
              <label>
                Eintragsart
                <Select
                  value={recordKind}
                  onChange={(e) => {
                    RecordKind(e.target.value);
                    E("");
                  }}
                >
                  <option>Arbeitszeit</option>
                  <option>Urlaub</option>
                  <option>Krankheit</option>
                  <option>Frei</option>
                </Select>
              </label>
            )}
            {recordKind !== "Arbeitszeit" ? (
              <>
                <label>
                  Datum der Abwesenheit
                  <GermanDateInput
                    required
                    value={absenceDate}
                    onValueChange={AbsenceDate}
                  />
                </label>
                <p className="muted">
                  {recordKind} wird im Verlauf und in der Statistik angezeigt.
                  Die Sollzeit dieses Tages entfällt; es wird keine Arbeitszeit
                  hinzugefügt.
                </p>
              </>
            ) : (
              <>
                <label>
                  Beschreibung
                  <input
                    value={edit.name}
                    onChange={(e) => Edit({ ...edit, name: e.target.value })}
                  />
                </label>
                {(["start", "end"] as const).map((k) => (
                  <label key={k}>
                    {k === "start" ? "Beginn" : "Ende"}
                    <GermanDateInput
                      dateTime
                      required={k === "start" || !!edit.end}
                      value={
                        edit[k]
                          ? DateTime.fromISO(edit[k]!)
                              .setZone("Europe/Berlin")
                              .toFormat("yyyy-MM-dd'T'HH:mm:ss")
                          : ""
                      }
                      onValueChange={(value) => {
                        const d = DateTime.fromISO(value, {
                          zone: "Europe/Berlin",
                        });
                        if (d.isValid)
                          Edit({ ...edit, [k]: d.toUTC().toISO()! });
                      }}
                    />
                  </label>
                ))}
                <PauseEditor
                  entry={edit}
                  zone={
                    s.profiles.find((x) => x.id === edit.profileId)?.zone ||
                    p.zone
                  }
                  onChange={(pauses) => Edit({ ...edit, pauses })}
                />
                {select("category", edit.categoryId, (v) =>
                  Edit({ ...edit, categoryId: v }),
                )}
                {select("project", edit.projectId, (v) => {
                  const e = {
                    ...edit,
                    projectId: v,
                    customerId:
                      s.entities.find((x) => x.id === v)?.customerId || "",
                  };
                  Edit({
                    ...e,
                    ...(e.rateMode === "auto" ? resolveRate(s, p, e) : {}),
                  });
                })}
                {select("customer", edit.customerId, (v) => {
                  const e = { ...edit, customerId: v };
                  Edit({
                    ...e,
                    ...(e.rateMode === "auto" ? resolveRate(s, p, e) : {}),
                  });
                })}
                {rates(edit.rateMode, (v) =>
                  Edit({
                    ...edit,
                    rateMode: v,
                    ...resolveRate(s, p, { ...edit, rateMode: v }),
                  }),
                )}
                <div className="tag-options">
                  {entities("tag").map((t) => (
                    <label key={t.id}>
                      <input
                        type="checkbox"
                        checked={edit.tags.includes(t.id)}
                        onChange={(e) =>
                          Edit({
                            ...edit,
                            tags: e.target.checked
                              ? [...edit.tags, t.id]
                              : edit.tags.filter((x) => x !== t.id),
                          })
                        }
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
                <small>
                  Gespeicherter Satz:{" "}
                  {edit.rateCents === undefined
                    ? "ohne"
                    : money(edit.rateCents) + "/h"}
                  . Satzänderungen gelten für den ganzen Eintrag.
                </small>
              </>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => Edit(null)}
              >
                Abbrechen
              </button>
              <button className="primary">Speichern</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
function Metric({
  title,
  value,
  sub,
  accent = false,
}: {
  title: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <section className={"card metric " + (accent ? "accent" : "")}>
      <div>{title}</div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </section>
  );
}
import SettingsPanel from "./SettingsPanel";
