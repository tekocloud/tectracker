import { test, expect } from "@playwright/test";

test("Überstunden einrichten, korrigieren, wieder laden und getrennt je Profil führen", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-02-03T12:00:00Z") });
  await page.addInitScript(() => {
    if (localStorage.getItem("tectracker")) return;
    localStorage.setItem(
      "tectracker",
      JSON.stringify({
        version: 1,
        profiles: [
          {
            id: "work",
            name: "Arbeit",
            zone: "Europe/Berlin",
            plans: [
              { from: "2026-01-01", seconds: 144000, days: [1, 2, 3, 4, 5] },
            ],
          },
          {
            id: "side",
            name: "Nebenjob",
            zone: "Europe/Berlin",
            plans: [{ from: "2026-01-01", seconds: 0, days: [1] }],
          },
        ],
        entries: [
          {
            id: "e",
            profileId: "work",
            name: "Test",
            start: "2026-01-30T07:00:00Z",
            end: "2026-01-30T16:00:00Z",
            pauses: [],
            tags: [],
            rateMode: "none",
          },
        ],
        entities: [],
        days: [],
        theme: "light",
        revision: 0,
        journal: [],
      }),
    );
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Überstundenkonto einrichten", exact: true })
    .click();
  await expect(page.getByLabel("Startdatum")).toHaveValue("30.01.2026");
  await page
    .getByLabel("Anfangssaldo (Stunden:Minuten)", { exact: true })
    .fill("10:00");
  await page
    .getByRole("button", { name: "Überstundenkonto speichern" })
    .click();
  await expect(
    page
      .locator(".overtime-metrics .metric")
      .filter({ hasText: "HEUTE VORAUSSICHTLICH" })
      .getByText("−5:00:00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "3:00:00", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Saldo anpassen", exact: true })
    .click();
  await expect(page.getByText("Bisheriger Stand: 3:00:00")).toBeVisible();
  await page
    .getByLabel("Gewünschter Stand (Stunden:Minuten)", { exact: true })
    .fill("2:00");
  await expect(page.getByText("Veränderung: −1:00:00")).toBeVisible();
  await page.getByLabel("Grund (optional)").fill("Teilweise ausgezahlt");
  await page
    .getByRole("button", { name: "Saldo speichern", exact: true })
    .click();
  await expect(page.getByText(/Gesetzter Stand: 2:00:00/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Überstunden", exact: true }).click();
  await expect(page.getByText(/Gesetzter Stand: 2:00:00/)).toBeVisible();
  await page
    .getByRole("button", { name: "Saldo anpassen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Auf null setzen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Saldo speichern", exact: true })
    .click();
  await expect(page.getByText(/Gesetzter Stand: 0:00:00/)).toHaveCount(1);
  await page.getByLabel("Profil", { exact: true }).selectOption("side");
  await expect(
    page.getByRole("heading", {
      name: "Überstundenkonto einrichten",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Profil", { exact: true }).selectOption("work");
  await page
    .getByRole("button", { name: "Korrektur löschen", exact: true })
    .click();
  await page.getByRole("button", { name: "Bestätigen", exact: true }).click();
  await expect(
    page.getByText("Noch keine Saldoanpassungen vorhanden."),
  ).toBeVisible();
});
