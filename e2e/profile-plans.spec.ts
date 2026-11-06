import { test, expect } from "@playwright/test";

test("Arbeitszeitpläne bleiben pro Profil getrennt", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("tectracker")) return;
    localStorage.setItem("tectracker", JSON.stringify({
      version: 1,
      profiles: [
        { id: "work", name: "Arbeit", zone: "Europe/Berlin", plans: [{ from: "2026-01-01", seconds: 133200, days: [1, 2, 3, 4, 5] }] },
        { id: "side", name: "Nebenjob", zone: "Europe/Berlin", plans: [{ from: "2026-01-01", seconds: 28800, days: [6] }] },
      ],
      entities: [], entries: [], days: [], theme: "light", revision: 0, journal: [],
    }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
  const profile = page.getByLabel("Arbeitszeitplan für Profil");
  await expect(page.getByLabel("Wochenstunden")).toHaveValue("37");
  await profile.selectOption("side");
  await expect(page.getByLabel("Wochenstunden")).toHaveValue("8");
  await expect(page.getByLabel("Sa", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Mo", { exact: true })).not.toBeChecked();
  await page.getByLabel("Wochenstunden").fill("10");
  await page.getByRole("button", { name: "Arbeitszeitplan speichern" }).click();
  await profile.selectOption("work");
  await expect(page.getByLabel("Wochenstunden")).toHaveValue("37");
  await expect(page.getByLabel("Mo", { exact: true })).toBeChecked();
  await profile.selectOption("side");
  await expect(page.getByLabel("Wochenstunden")).toHaveValue("10");
  await page.reload();
  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
  await profile.selectOption("side");
  await expect(page.getByLabel("Wochenstunden")).toHaveValue("10");
  await profile.selectOption("work");
  await expect(page.getByLabel("Wochenstunden")).toHaveValue("37");
});
