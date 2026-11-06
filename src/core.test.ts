import { describe, it, expect } from "vitest";
import {
  initial,
  target,
  slices,
  resolveRate,
  validateEntry,
  type Entry,
} from "./core";
import { parseBackup } from "./storage";
const entry = (profileId: string, patch: Partial<Entry> = {}): Entry => ({
  id: "e",
  profileId,
  name: "Beratung",
  start: "2026-01-05T09:00:00Z",
  end: "2026-01-05T10:30:00Z",
  tags: [],
  pauses: [],
  rateMode: "none",
  rateCents: 8000,
  ...patch,
});
describe("Arbeitszeit", () => {
  it("verteilt 37 Stunden auf fünf Tage", () => {
    const s = initial();
    expect(target(s.profiles[0], "2026-01-05", [])).toBe(26640);
    expect(target(s.profiles[0], "2026-01-10", [])).toBe(0);
  });
  it("bewahrt historische Pläne und berücksichtigt Abwesenheit", () => {
    const s = initial(),
      p = s.profiles[0];
    p.plans.push({
      from: "2026-02-01",
      seconds: 40 * 3600,
      days: [1, 2, 3, 4, 5],
    });
    expect(target(p, "2026-01-05", [])).toBe(26640);
    expect(target(p, "2026-02-02", [])).toBe(28800);
    expect(
      target(p, "2026-02-02", [
        {
          profileId: p.id,
          date: "2026-02-02",
          actual: 0,
          planned: 0,
          absence: "Urlaub",
        },
      ]),
    ).toBe(0);
    expect(target(p, "2099-01-01", [])).toBe(0);
  });
  it("verliert keine Restsekunden", () => {
    const s = initial(),
      p = s.profiles[0];
    p.plans[0].seconds = 100003;
    expect(
      [5, 6, 7, 8, 9].reduce((n, d) => n + target(p, `2026-01-0${d}`, []), 0),
    ).toBe(100003);
  });
  it("berechnet 120 EUR und nach Pause 100 EUR", () => {
    const s = initial(),
      id = s.profiles[0].id;
    s.entries = [entry(id)];
    expect(slices(s)[0].cents).toBe(12000);
    s.days = [
      {
        profileId: id,
        date: "2026-01-05",
        actual: 900,
        planned: 1800,
        absence: "",
      },
    ];
    expect(slices(s)[0].cents).toBe(10000);
  });
  it("zieht Timerpausen nicht doppelt ab", () => {
    const s = initial(),
      id = s.profiles[0].id;
    s.entries = [
      entry(id, {
        pauses: [
          { start: "2026-01-05T09:00:00Z", end: "2026-01-05T09:15:00Z" },
        ],
      }),
    ];
    s.days = [
      {
        profileId: id,
        date: "2026-01-05",
        actual: 900,
        planned: 0,
        absence: "",
      },
    ];
    expect(slices(s)[0].net).toBe(4500);
    expect(slices(s)[0].cents).toBe(10000);
  });
  it("verteilt Tagespausen proportional", () => {
    const s = initial(),
      id = s.profiles[0].id;
    s.entries = [
      entry(id, { end: "2026-01-05T10:00:00Z" }),
      entry(id, { id: "b", start: "2026-01-05T10:00:00Z" }),
    ];
    s.days = [
      {
        profileId: id,
        date: "2026-01-05",
        actual: 900,
        planned: 0,
        absence: "",
      },
    ];
    expect(slices(s).map((x) => x.net)).toEqual([3000, 1500]);
  });
  it("teilt Mitternacht und Sommerzeit korrekt auf", () => {
    const s = initial(),
      id = s.profiles[0].id;
    s.entries = [
      entry(id, { start: "2026-03-28T22:00:00Z", end: "2026-03-29T03:00:00Z" }),
    ];
    expect(slices(s).map((x) => x.gross)).toEqual([3600, 14400]);
  });
  it("behandelt offene Timer und Pausen vorläufig", () => {
    const s = initial(),
      id = s.profiles[0].id;
    s.entries = [
      entry(id, {
        end: undefined,
        pauses: [{ start: "2026-01-05T09:30:00Z" }],
      }),
    ];
    expect(slices(s, Date.parse("2026-01-05T10:00:00Z"))[0].net).toBe(1800);
  });
  it("lehnt Überschneidungen ab und erlaubt angrenzende Zeiten", () => {
    const s = initial(),
      id = s.profiles[0].id;
    s.entries = [entry(id)];
    expect(() => validateEntry(s, entry(id, { id: "b" }))).toThrow(
      "überschneidet",
    );
    expect(() =>
      validateEntry(
        s,
        entry(id, {
          id: "b",
          start: "2026-01-05T10:30:00Z",
          end: "2026-01-05T11:00:00Z",
        }),
      ),
    ).not.toThrow();
  });
  it("priorisiert Projekt, Kunde, Profil und manuelle Preise", () => {
    const s = initial(),
      p = s.profiles[0];
    s.entities = [
      { id: "r", kind: "rate", profileId: p.id, name: "Standard", cents: 5000 },
      { id: "r2", kind: "rate", profileId: p.id, name: "Projekt", cents: 8000 },
      {
        id: "pr",
        kind: "project",
        profileId: p.id,
        name: "Projekt",
        rateId: "r2",
      },
    ];
    p.rateId = "r";
    expect(
      resolveRate(s, p, { projectId: "pr", rateMode: "auto" }).rateCents,
    ).toBe(8000);
    expect(
      resolveRate(s, p, { projectId: "pr", rateMode: "r" }).rateCents,
    ).toBe(5000);
    expect(resolveRate(s, p, { rateMode: "none" }).rateCents).toBeUndefined();
    const e = entry(p.id);
    s.entities[1].cents = 9000;
    expect(e.rateCents).toBe(8000);
  });
  it("validiert Sicherungsversionen und erhält Umlaute", () => {
    const s = initial();
    s.profiles[0].name = "Büro";
    expect(parseBackup(JSON.stringify(s))).toEqual(s);
    expect(() => parseBackup('{"version":2}')).toThrow();
  });
});
