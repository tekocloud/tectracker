import { it, expect } from "vitest";
import { germanDate, parseGermanInput } from "./GermanDateInput";
it("liest deutsche Daten eindeutig und lehnt ungültige Daten ab", () => {
  expect(parseGermanInput("06.11.2026")?.toISODate()).toBe("2026-11-06");
  expect(parseGermanInput("11/06/2026")).toBeNull();
  expect(parseGermanInput("31.02.2026")).toBeNull();
  expect(parseGermanInput("29.02.2024")?.toISODate()).toBe("2024-02-29");
});
it("berücksichtigt deutsche Winter- und Sommerzeit", () => {
  expect(parseGermanInput("06.11.2026 09:00", true)?.toUTC().toISO()).toBe(
    "2026-11-06T08:00:00.000Z",
  );
  expect(parseGermanInput("06.07.2026 09:00:15", true)?.toUTC().toISO()).toBe(
    "2026-07-06T07:00:15.000Z",
  );
  expect(parseGermanInput("29.03.2026 02:30", true)).toBeNull();
});
it("stellt auch UTC-Daten an deutschen Tagesgrenzen richtig dar", () => {
  expect(germanDate("2026-11-05T23:30:00Z")).toBe("06.11.2026");
});
