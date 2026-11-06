import { DateTime } from "luxon";
import { scheduledTarget, slices, type Profile, type State } from "./core";

export function overtime(s: State, p: Profile, now = Date.now()) {
  const account = p.overtime;
  if (!account) return null;
  const today = DateTime.fromMillis(now, { zone: p.zone }).toISODate()!;
  const net = new Map<string, number>();
  for (const row of slices(s, now)) {
    if (row.entry.profileId === p.id)
      net.set(row.date, (net.get(row.date) || 0) + row.net);
  }
  const absences = new Set(
    s.days.filter((d) => d.profileId === p.id && d.absence).map((d) => d.date),
  );
  const corrections = new Map(account.corrections.map((c) => [c.date, c]));
  let balance = account.openingSeconds;
  const days: {
    date: string;
    before: number;
    balance: number;
    adjustment: number;
  }[] = [];
  const months: {
    month: string;
    change: number;
    adjustment: number;
    balance: number;
  }[] = [];
  for (
    let d = DateTime.fromISO(account.from, { zone: p.zone });
    d.toISODate()! < today;
    d = d.plus({ days: 1 })
  ) {
    const date = d.toISODate()!;
    const change =
      (net.get(date) || 0) -
      (absences.has(date) ? 0 : scheduledTarget(p, date));
    const before = balance + change;
    balance = corrections.get(date)?.seconds ?? before;
    const adjustment = balance - before;
    days.push({ date, before, balance, adjustment });
    const month = date.slice(0, 7);
    if (months.at(-1)?.month !== month)
      months.push({ month, change: 0, adjustment: 0, balance });
    const row = months[months.length - 1];
    row.change += change;
    row.adjustment += adjustment;
    row.balance = balance;
  }
  const preview =
    balance +
    (today >= account.from
      ? (net.get(today) || 0) -
        (absences.has(today) ? 0 : scheduledTarget(p, today))
      : 0);
  return { balance, preview, days, months, today };
}

export function parseHours(value: string) {
  const match = /^([+-]?)(\d+):([0-5]\d)$/.exec(value.trim());
  if (!match)
    throw Error("Bitte Stunden und Minuten eingeben, z. B. 12:30 oder -2:15.");
  const seconds =
    (Number(match[2]) * 3600 + Number(match[3]) * 60) *
    (match[1] === "-" ? -1 : 1);
  if (!Number.isSafeInteger(seconds))
    throw Error("Der Stundenwert ist zu groß.");
  return seconds;
}
