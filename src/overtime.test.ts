import { describe, expect, it } from "vitest";
import { initial, type Entry } from "./core";
import { overtime, parseHours } from "./overtime";
import { parseBackup } from "./storage";

const now = Date.parse("2026-02-03T12:00:00Z");
function fixture() {
  const s = initial();
  const p = s.profiles[0];
  p.plans = [{ from: "2026-01-01", seconds: 40 * 3600, days: [1, 2, 3, 4, 5] }];
  p.overtime = {
    from: "2026-01-30",
    openingSeconds: 10 * 3600,
    corrections: [],
  };
  return { s, p };
}
function entry(profileId: string, start: string, end?: string): Entry {
  return {
    id: crypto.randomUUID(),
    profileId,
    name: "Test",
    start,
    end,
    pauses: [],
    tags: [],
    rateMode: "none",
  };
}
describe("Überstundenkonto", () => {
  it("berechnet Monatsübertrag, fehlende Tage, Anfangssaldo und heutige Vorschau", () => {
    const { s, p } = fixture();
    s.entries.push(entry(p.id, "2026-01-30T07:00:00Z", "2026-01-30T16:00:00Z"));
    s.entries.push(entry(p.id, "2026-02-03T08:00:00Z"));
    const result = overtime(s, p, now)!;
    expect(result.months.map((m) => m.balance)).toEqual([11 * 3600, 3 * 3600]);
    expect(result.balance).toBe(3 * 3600);
    expect(result.preview).toBe(-3600);
  });
  it("behält gesetzte Tagesendstände bei rückwirkenden Änderungen und berücksichtigt Löschungen", () => {
    const { s, p } = fixture();
    p.overtime!.corrections = [
      { date: "2026-01-31", seconds: 4 * 3600, reason: "Verfall" },
      { date: "2026-02-02", seconds: 0, reason: "Auszahlung" },
    ];
    expect(overtime(s, p, now)!.balance).toBe(0);
    s.entries.push(entry(p.id, "2026-01-30T07:00:00Z", "2026-01-30T16:00:00Z"));
    expect(overtime(s, p, now)!.balance).toBe(0);
    p.overtime!.corrections.pop();
    expect(overtime(s, p, now)!.balance).toBe(-4 * 3600);
  });
  it("berücksichtigt Abwesenheiten, Planwechsel und Profiltrennung", () => {
    const { s, p } = fixture();
    p.plans.push({
      from: "2026-02-01",
      seconds: 20 * 3600,
      days: [1, 2, 3, 4, 5],
    });
    s.days.push({
      profileId: p.id,
      date: "2026-01-30",
      absence: "Urlaub",
      actual: 0,
      planned: 0,
    });
    s.profiles.push({ ...p, id: "other", overtime: undefined });
    s.entries.push(
      entry("other", "2026-02-02T07:00:00Z", "2026-02-02T16:00:00Z"),
    );
    expect(overtime(s, p, now)!.balance).toBe(6 * 3600);
    expect(overtime(s, s.profiles[1], now)).toBeNull();
  });
  it("teilt Jahreswechsel und Pausen um Mitternacht korrekt auf", () => {
    const { s, p } = fixture();
    p.overtime!.from = "2025-12-31";
    p.plans = [{ from: "2025-01-01", seconds: 0, days: [1] }];
    const e = entry(p.id, "2025-12-31T22:00:00Z", "2026-01-01T01:00:00Z");
    e.pauses = [{ start: "2025-12-31T22:30:00Z", end: "2025-12-31T23:30:00Z" }];
    s.entries.push(e);
    expect(
      overtime(s, p, Date.parse("2026-01-02T12:00:00Z"))!.months.map(
        (m) => m.change,
      ),
    ).toEqual([1800, 5400]);
  });
  it("startet heute ohne abgeschlossene Tage und ohne zukünftige Arbeitszeiten", () => {
    const { s, p } = fixture();
    p.overtime!.from = "2026-02-03";
    s.entries.push(entry(p.id, "2026-02-04T08:00:00Z", "2026-02-04T09:00:00Z"));
    const result = overtime(s, p, now)!;
    expect(result.days).toEqual([]);
    expect(result.balance).toBe(10 * 3600);
    expect(result.preview).toBe(2 * 3600);
  });
  it("validiert Stunden und sichert alte und neue Daten kompatibel", () => {
    expect(parseHours("-2:15")).toBe(-8100);
    for (const bad of ["2:60", "NaN", "1.5", "", "999999999999999:00"])
      expect(() => parseHours(bad)).toThrow();
    expect(parseBackup(JSON.stringify(initial()))).toBeTruthy();
    const { s, p } = fixture();
    p.overtime!.corrections.push({
      date: "2026-02-01",
      seconds: -3600,
      reason: "Test",
    });
    expect(parseBackup(JSON.stringify(s)).profiles[0].overtime).toEqual(
      p.overtime,
    );
    for (const patch of [
      { from: "2026-02-30" },
      { openingSeconds: 1.2 },
      { corrections: [{ date: "2026-01-01", seconds: 0, reason: "" }] },
      { corrections: [p.overtime!.corrections[0], p.overtime!.corrections[0]] },
    ]) {
      const bad = structuredClone(s);
      Object.assign(bad.profiles[0].overtime!, patch);
      expect(() => parseBackup(JSON.stringify(bad))).toThrow();
    }
  });
});
