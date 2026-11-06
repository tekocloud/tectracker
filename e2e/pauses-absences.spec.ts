import { test, expect, type Page } from "@playwright/test";
test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("Datumsfelder folgen der Tab-Reihenfolge und übernehmen das Beginndatum", async ({
  page,
}) => {
  await seed(page, true);
  await page.getByTitle("Bearbeiten", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  const names = ["Tag", "Monat", "Jahr", "Stunde", "Minute", "Sekunde"];
  await dialog.getByLabel("Beginn Tag", { exact: true }).focus();
  for (const prefix of ["Beginn", "Ende"]) {
    for (const name of names) {
      const field = dialog.getByLabel(`${prefix} ${name}`, { exact: true });
      await expect(field).toBeFocused();
      await field.press("Tab");
    }
  }
  await dialog.getByLabel("Beginn Tag", { exact: true }).fill("05");
  await expect(dialog.getByLabel("Ende Tag", { exact: true })).toHaveValue(
    "05",
  );
  await expect(dialog.getByLabel("Ende Stunde", { exact: true })).toHaveValue(
    "17",
  );
  await dialog.getByLabel("Beginn Monat", { exact: true }).fill("10");
  await expect(dialog.getByLabel("Ende Monat", { exact: true })).toHaveValue(
    "10",
  );
  await dialog.getByLabel("Beginn Jahr", { exact: true }).fill("2025");
  await expect(dialog.getByLabel("Ende Jahr", { exact: true })).toHaveValue(
    "2025",
  );
  await dialog.getByLabel("Beginn Sekunde", { exact: true }).fill("12");
  await dialog.getByLabel("Ende Tag", { exact: true }).fill("06");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const entry = await page.evaluate(
    () => JSON.parse(localStorage.getItem("tectracker")!).entries[0],
  );
  expect(entry.start).toBe("2025-10-05T07:00:12.000Z");
  expect(entry.end).toBe("2025-10-06T15:00:00.000Z");
});
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

test("Ziffern bleiben beim Tippen und Tab-Wechsel unverändert", async ({ page }) => {
  await seed(page, true);
  await page.getByTitle("Bearbeiten", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ende Tag", { exact: true }).focus();
  for (const [name, value] of [["Tag", "16"], ["Monat", "12"], ["Jahr", "2026"], ["Stunde", "21"], ["Minute", "51"], ["Sekunde", "42"]]) {
    const field = dialog.getByLabel(`Ende ${name}`, { exact: true });
    await expect(field).toBeFocused();
    await field.pressSequentially(value[0]);
    await expect(field).toHaveValue(value[0]);
    await field.pressSequentially(value.slice(1));
    await expect(field).toHaveValue(value);
    await field.press("Tab");
  }
  const minute = dialog.getByLabel("Ende Minute", { exact: true });
  await minute.focus();
  await minute.pressSequentially("5");
  await expect(minute).toHaveValue("5");
  await minute.press("Tab");
  await expect(minute).toHaveValue("05");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const end = await page.evaluate(() => JSON.parse(localStorage.getItem("tectracker")!).entries[0].end);
  expect(end).toBe("2026-12-16T20:05:42.000Z");
});
test("mehrere Pausen hinzufügen, validieren, speichern und bearbeiten", async ({
  page,
}) => {
  await seed(page, true);
  await page.getByTitle("Bearbeiten", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Beginn Tag", { exact: true })).toHaveValue(
    "06",
  );
  await expect(dialog.getByLabel("Beginn Stunde", { exact: true })).toHaveValue(
    "09",
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
  await expect(page.locator(".history-day .absence-entry")).toContainText(
    "Urlaub",
  );
  await expect(page.locator(".absence-summary")).toHaveCount(0);
  await expect(page.locator(".history-day .absence-entry")).toContainText(
    "−7:24:00",
  );
  await page.reload();
  await page.getByRole("button", { name: "Statistik", exact: true }).click();
  await expect(page.locator(".absence-row")).toContainText("06.11.2026");
});
test("Abwesenheiten stehen zwischen Arbeitszeiten am passenden Datum und reduzieren die ganze Woche", async ({
  page,
}) => {
  await seed(page, true, true);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("tectracker")!);
    s.days.push(
      {
        profileId: "profile",
        date: "2026-11-04",
        absence: "Krankheit",
        actual: 0,
        planned: 0,
      },
      {
        profileId: "profile",
        date: "2026-11-03",
        absence: "Frei",
        actual: 0,
        planned: 0,
      },
    );
    s.entries.push({
      ...s.entries[0],
      id: "older",
      start: "2026-11-02T08:00:00Z",
      end: "2026-11-02T16:00:00Z",
    });
    localStorage.setItem("tectracker", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button", { name: "Verlauf", exact: true }).click();
  await expect(page.locator(".history-day .day-heading>strong")).toHaveText([
    "06.11.2026",
    "05.11.2026",
    "04.11.2026",
    "03.11.2026",
    "02.11.2026",
  ]);
  await expect(
    page.locator(".history-day .absence-entry .entry-title>strong"),
  ).toHaveText(["Urlaub", "Krankheit", "Frei"]);
  await expect(
    page.locator(".history-day").filter({ hasText: "05.11.2026" }),
  ).not.toContainText("Platz für deinen Arbeitstag");
  await expect(page.locator(".metrics")).toContainText("14:48:00");
  await expect(page.locator(".goal-adjustment")).toContainText(
    "37:00:00 − 22:12:00",
  );
  await page.screenshot({
    path: "test-results/verlauf-abwesenheiten.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("geplanter Urlaub reduziert die volle Wochen-Sollzeit ohne zukünftige Minusstunden", async ({
  page,
}) => {
  await seed(page, false, true);
  await page.clock.setFixedTime(new Date("2026-11-02T17:00:00Z"));
  await page.getByRole("button", { name: "Verlauf", exact: true }).click();
  await expect(page.locator(".metrics")).toContainText("29:36:00");
  await expect(page.locator(".metrics")).toContainText(
    "−7:24:00 Saldo bis heute",
  );
  await expect(page.locator(".history-day")).toContainText("05.11.2026");
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
test("Wochenfortschritt berücksichtigt Nettozeit, Abwesenheiten und das ausgewählte Profil", async ({
  page,
}) => {
  await seed(page, true, true);
  const week = page.getByRole("region", { name: "Wochenfortschritt" });
  await expect(week).toContainText("8:00:00 von 29:36:00 Wochen-Sollzeit");
  await expect(week).toContainText("21:36:00 bis zum Wochenziel");
  await expect(week.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "27",
  );
  await expect(week).toContainText("02.11.2026 – 08.11.2026");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("tectracker")!);
    s.entries[0].pauses = [
      { start: "2026-11-06T11:00:00Z", end: "2026-11-06T12:00:00Z" },
    ];
    s.profiles.push({
      id: "other",
      name: "Nebenjob",
      zone: "Europe/Berlin",
      plans: [{ from: "2026-01-01", seconds: 36000, days: [1, 2, 3, 4, 5] }],
    });
    localStorage.setItem("tectracker", JSON.stringify(s));
  });
  await page.reload();
  await expect(week).toContainText("7:00:00 von 29:36:00");
  await page.getByLabel("Profil", { exact: true }).selectOption("other");
  await expect(week).toContainText("0:00:00 von 10:00:00");
  await expect(week.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});
