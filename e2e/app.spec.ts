import { test, expect } from "@playwright/test";
test("Timer, Persistenz und Einstellungen", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Zeiterfassung", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Beschreibung", { exact: true })
    .fill("Konzept entwickeln");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stopp", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Beschreibung", { exact: true })).toHaveValue(
    "Konzept entwickeln",
  );
  await page.getByTitle("Pause / Fortsetzen").click();
  await expect(page.getByText("PAUSIERT", { exact: true })).toBeVisible();
  await page.getByTitle("Pause / Fortsetzen").click();
  await page.getByRole("button", { name: "Stopp", exact: true }).click();
  await page.getByRole("button", { name: "Stammdaten", exact: true }).click();
  await page.getByRole("button", { name: "Stundensätze", exact: true }).click();
  await page.getByPlaceholder("Bezeichnung").fill("Beratung");
  await page.getByLabel("Euro pro Stunde").fill("80");
  await page.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(page.getByText("80,00 €/h", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Statistik", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verteilung deiner Zeit" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/statistik.png", fullPage: true });
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Darstellung").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Zeiterfassung", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/zeiterfassung-dark.png",
    fullPage: true,
  });
});
test("CSV Vorschau, Preise und vollständige Sicherung", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  const csv =
    "name;start;end;category;tags;rate_eur\nBeratung;2026-11-06T09:00:00+01:00;2026-11-06T10:30:00+01:00;Konzeption;Kunde A|Fokus;80";
  await page.locator('input[type=file][accept=".csv"]').setInputFiles({
    name: "zeiten.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByRole("heading", { name: "CSV-Import prüfen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Importieren", exact: true }).click();
  await expect(
    page.getByText("1 Einträge importiert, 0 Duplikate übersprungen."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Statistik", exact: true }).click();
  await expect(
    page.getByText("120,00 €", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Vollständige Sicherung", exact: false })
    .click();
  const dl = await pending;
  expect(dl.suggestedFilename()).toContain("backup");
  const raw = await page.evaluate(() => localStorage.getItem("tectracker")!);
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bestätigen", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("tectracker-backup-before-restore"),
      ),
    )
    .toBe(raw);
  await page
    .getByRole("button", { name: "Zeiterfassung", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/zeiterfassung-light.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 700 });
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/zeiterfassung-1024.png",
    fullPage: true,
  });
});
