import { DateTime } from "luxon";
export type Entity = {
  id: string;
  name: string;
  kind: "category" | "tag" | "project" | "customer" | "rate";
  profileId: string;
  archived?: boolean;
  rateId?: string;
  customerId?: string;
  cents?: number;
};
export type Plan = { from: string; seconds: number; days: number[] };
export type Profile = {
  id: string;
  name: string;
  zone: string;
  plans: Plan[];
  rateId?: string;
  archived?: boolean;
};
export type Entry = {
  id: string;
  profileId: string;
  name: string;
  start: string;
  end?: string;
  pauses: { start: string; end?: string }[];
  categoryId?: string;
  projectId?: string;
  customerId?: string;
  tags: string[];
  rateMode: string;
  rateId?: string;
  rateCents?: number;
  deleted?: boolean;
};
export type Day = {
  profileId: string;
  date: string;
  actual: number;
  planned: number;
  absence: string;
};
export type State = {
  version: 1;
  profiles: Profile[];
  entities: Entity[];
  entries: Entry[];
  days: Day[];
  theme: string;
  revision: number;
  journal: { id: string; at: string; revision: number }[];
};
export const uid = () => crypto.randomUUID();
export const initial = (): State => ({
  version: 1,
  profiles: [
    {
      id: uid(),
      name: "Arbeit",
      zone: "Europe/Berlin",
      plans: [
        { from: "2026-01-01", seconds: 37 * 3600, days: [1, 2, 3, 4, 5] },
      ],
    },
  ],
  entities: [],
  entries: [],
  days: [],
  theme: "system",
  revision: 0,
  journal: [],
});
export const today = (zone = "Europe/Berlin") =>
  DateTime.now().setZone(zone).toISODate()!;
export const duration = (s: number) => {
  const n = Math.round(Math.abs(s));
  return `${s < 0 ? "−" : ""}${Math.floor(n / 3600)}:${String(Math.floor((n % 3600) / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
export const money = (c: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    c / 100,
  );
export function target(p: Profile, date: string, days: Day[]) {
  if (
    date > today(p.zone) ||
    days.some((d) => d.profileId === p.id && d.date === date && d.absence)
  )
    return 0;
  const plan = [...p.plans]
    .sort((a, b) => b.from.localeCompare(a.from))
    .find((x) => x.from <= date);
  if (!plan) return 0;
  const ds = [...plan.days].sort();
  const i = ds.indexOf(DateTime.fromISO(date).weekday);
  return i < 0
    ? 0
    : Math.floor(plan.seconds / ds.length) +
        (i < plan.seconds % ds.length ? 1 : 0);
}
export function resolveRate(s: State, p: Profile, e: Partial<Entry>) {
  const project = s.entities.find((x) => x.id === e.projectId);
  const customer = s.entities.find(
    (x) => x.id === (e.customerId || project?.customerId),
  );
  const id =
    e.rateMode === "none"
      ? undefined
      : e.rateMode && e.rateMode !== "auto"
        ? e.rateMode
        : project?.rateId || customer?.rateId || p.rateId;
  const r = s.entities.find((x) => x.id === id);
  return { rateId: r?.id, rateCents: r?.cents };
}
export type Slice = {
  entry: Entry;
  date: string;
  gross: number;
  pause: number;
  net: number;
  cents: number;
};
export function slices(s: State, now = DateTime.now().toMillis()): Slice[] {
  const out: Slice[] = [];
  for (const e of s.entries.filter((x) => !x.deleted)) {
    const p = s.profiles.find((x) => x.id === e.profileId);
    if (!p) continue;
    let start = DateTime.fromISO(e.start).setZone(p.zone),
      end = DateTime.fromMillis(
        e.end ? DateTime.fromISO(e.end).toMillis() : now,
      ).setZone(p.zone);
    while (start < end) {
      const next = start.plus({ days: 1 }).startOf("day");
      const stop = Math.min(next.toMillis(), end.toMillis());
      const a = start.toMillis();
      const gross = (stop - a) / 1000;
      const pause = e.pauses.reduce(
        (sum, b) =>
          sum +
          Math.max(
            0,
            Math.min(stop, b.end ? DateTime.fromISO(b.end).toMillis() : now) -
              Math.max(a, DateTime.fromISO(b.start).toMillis()),
          ) /
            1000,
        0,
      );
      out.push({
        entry: e,
        date: start.toISODate()!,
        gross,
        pause,
        net: Math.max(0, gross - pause),
        cents: 0,
      });
      start = next;
    }
  }
  for (const p of s.profiles) {
    const dates = new Set(
      out.filter((x) => x.entry.profileId === p.id).map((x) => x.date),
    );
    for (const date of dates) {
      const group = out.filter(
        (x) => x.entry.profileId === p.id && x.date === date,
      );
      const total = group.reduce((a, x) => a + x.net, 0),
        recorded = group.reduce((a, x) => a + x.pause, 0);
      const actual =
        s.days.find((x) => x.profileId === p.id && x.date === date)?.actual ||
        0;
      const extra = Math.min(total, Math.max(0, actual - recorded));
      for (const x of group) {
        x.net -= total ? (extra * x.net) / total : 0;
        const micros = BigInt(Math.round(x.net * 1000000));
        x.cents =
          x.entry.rateCents === undefined
            ? 0
            : Number(
                (micros * BigInt(x.entry.rateCents) + 1800000000n) /
                  3600000000n,
              );
      }
    }
  }
  return out;
}
export function validateEntry(s: State, e: Entry) {
  const a = DateTime.fromISO(e.start).toMillis(),
    b = e.end ? DateTime.fromISO(e.end).toMillis() : Infinity;
  if (!Number.isFinite(a) || b <= a || (e.end && !Number.isFinite(b)))
    throw Error("Bitte gültige Start- und Endzeit angeben.");
  let previous = a;
  for (const pause of e.pauses) {
    const ps = Date.parse(pause.start),
      pe = pause.end ? Date.parse(pause.end) : b;
    if (
      !Number.isFinite(ps) ||
      ps < previous ||
      pe < ps ||
      pe > b ||
      ps < a ||
      (!pause.end && !!e.end)
    )
      throw Error("Pausen müssen geordnet innerhalb des Eintrags liegen.");
    previous = pe;
  }
  const intervals = (x: Entry) => {
    let cursor = DateTime.fromISO(x.start).toMillis();
    const result: number[][] = [];
    for (const p of x.pauses) {
      const stop = DateTime.fromISO(p.start).toMillis();
      if (stop > cursor) result.push([cursor, stop]);
      cursor = p.end ? DateTime.fromISO(p.end).toMillis() : Infinity;
    }
    const end = x.end ? DateTime.fromISO(x.end).toMillis() : Infinity;
    if (end > cursor) result.push([cursor, end]);
    return result;
  };
  if (
    s.entries.some(
      (x) =>
        !x.deleted &&
        x.id !== e.id &&
        intervals(x).some(([c, d]) =>
          intervals(e).some(([a, b]) => a < d && c < b),
        ),
    )
  )
    throw Error(
      "Diese Arbeitszeit überschneidet sich mit einem anderen Eintrag.",
    );
}
