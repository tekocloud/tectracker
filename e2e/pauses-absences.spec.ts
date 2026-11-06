import { test, expect, type Page } from "@playwright/test";
test.use({ locale: "en-US", timezoneId: "America/New_York" });
async function seed(page: Page, withEntry = false, legacyAbsence = false) {
  await page.clock.install({ time: new Date("2026-11-06T17:00:00Z") });
  const state = {
    version: 1,
    profiles: [
      {
        id: "profile",
        name: "Arbeit",
        zone: "Europe/Berlin",
        plans: [{ from: "2026-01-01", seconds: 133200, days: [1, 2, 3, 4, 5] }],
      },
    ],
    entities: [],
    entries: withEntry
      ? [
          {
            id: "entry",
            profileId: "profile",
            name: "Arbeitstag",
            start: "2026-11-06T08:00:00Z",
            end: "2026-11-06T16:00:00Z",
            pauses: [],
            tags: [],
            rateMode: "none",
            rateCents: 8000,
          },
        ]
      : [],
    days: legacyAbsence
      ? [
          {
            profileId: "profile",
            date: "2026-11-05",
            actual: 0,
            planned: 0,
            absence: "Urlaub",
          },
        ]
      : [],
    theme: "light",
    revision: 0,
    journal: [],
  };
  await page.addInitScript((state) => {
    if (!localStorage.getItem("tectracker"))
      localStorage.setItem("tectracker", JSON.stringify(state));
  }, state);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Zeiterfassung", exact: true }),
  ).toBeVisible();
}
test("mehrere Pausen hinzufügen, validieren, speichern und bearbeiten", async ({
  page,
}) => {
  await seed(page, true);
  await page.getByTitle("Bearbeiten", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Beginn", { exact: true })).toHaveValue(
    "06.11.2026 09:00:00",
  );
  await expect(dialog.getByText("Noch keine Pause eingetragen.")).toBeVisible();
  await dialog.getByRole("button", { name: "Pause hinzufügen" }).click();
  await dialog
    .getByLabel("Pause 1 Beginn", { exact: true })
    .fill("06.11.2026 12:00:00");
  await dialog
    .getByLabel("Pause 1 Ende", { exact: true })
    .fill("06.11.2026 12:30:00");
  await dialog.getByRole("button", { name: "Pause hinzufügen" }).click();
  await dialog
    .getByLabel("Pause 2 Beginn", { exact: true })
    .fill("06.11.2026 12:15:00");
  await dialog
    .getByLabel("Pause 2 Ende", { exact: true })
    .fill("06.11.2026 12:45:00");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("überschneiden");
  await dialog
    .getByLabel("Pause 2 Beginn", { exact: true })
    .fill("06.11.2026 15:00:00");
  await dialog
    .getByLabel("Pause 2 Ende", { exact: true })
    .fill("06.11.2026 15:15:00");
  await expect(dialog.locator(".pause-summary")).toContainText("0:45:00");
  await page.screenshot({
    path: "test-results/pausen-bearbeiten.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".metrics")).toContainText("7:15:00");
  await expect(page.locator(".metrics")).toContainText("580,00 €");
  await page.reload();
  await page.getByTitle("Bearbeiten", { exact: true }).click();
  await expect(
    dialog.getByLabel("Pause 2 Beginn", { exact: true }),
  ).toHaveValue("06.11.2026 15:00:00");
  await dialog
    .getByRole("button", { name: "Pause 1 entfernen", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator(".metrics")).toContainText("7:45:00");
});
test("Urlaub über Zeit nachtragen wirkt auf Sollzeit und erscheint im Verlauf und der Statistik", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Zeit nachtragen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Eintragsart").selectOption("Urlaub");
  await dialog.getByLabel("Datum der Abwesenheit").fill("06.11.2026");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".metrics")).toContainText("von 0:00:00 Sollzeit");
  await page.getByRole("button", { name: "Statistik", exact: true }).click();
  await expect(page.locator(".absence-summary")).toContainText("Urlaub: 1 Tag");
  await expect(page.locator(".absence-row")).toContainText(
    "7:24:00 Sollzeit entfällt",
  );
  await expect(page.locator(".metrics")).toContainText("29:36:00");
  await page.screenshot({
    path: "test-results/urlaub-statistik.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Verlauf", exact: true }).click();
  await expect(page.locator(".absence-row")).toContainText("Urlaub");
  await page.reload();
  await page.getByRole("button", { name: "Statistik", exact: true }).click();
  await expect(page.locator(".absence-row")).toContainText("06.11.2026");
});
test("Einstellungen enthalten keine Abwesenheitseingabe; Altdaten bleiben sichtbar", async ({
  page,
}) => {
  await seed(page, false, true);
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Abwesenheiten nachtragen" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Abwesenheitsdatum")).toHaveCount(0);
  await expect(page.getByLabel("Gültig ab")).toHaveValue("06.11.2026");
  await page.getByRole("button", { name: "Statistik", exact: true }).click();
  await expect(page.locator(".absence-row")).toContainText("05.11.2026");
  await expect(page.locator(".metrics")).toContainText("29:36:00");
});
