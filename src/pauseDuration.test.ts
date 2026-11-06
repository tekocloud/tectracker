import { expect, it } from "vitest";
import { parsePauseDuration } from "./pauseDuration";

it("liest Tagespausen als Minuten oder Stunden:Minuten:Sekunden", () => {
  for (const text of [
    "45min",
    "45 min",
    "45 Minuten",
    "45",
    "00:45:00",
    "0:45",
  ])
    expect(parsePauseDuration(text)).toBe(2700);
  expect(parsePauseDuration("1,5min")).toBe(90);
  expect(parsePauseDuration("")).toBe(0);
  for (const text of ["-45min", "00:60:00", "irgendwas"])
    expect(() => parsePauseDuration(text)).toThrow();
});
