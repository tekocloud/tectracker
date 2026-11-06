import { test, expect } from "@playwright/test";

test("Dropdowns folgen dem Theme und lassen sich mit Maus und Tastatur bedienen", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  const theme = page.getByLabel("Darstellung");
  await theme.click();
  const popup = page.getByRole("listbox");
  await expect(popup).toBeVisible();
  await expect(theme).toBeFocused();
  await popup.getByRole("option", { name: "Dunkel", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(popup).not.toBeVisible();
  await theme.press("Enter");
  await expect(popup).toHaveCSS("background-color", "rgb(26, 35, 48)");
  await theme.press("Home");
  await theme.press("Enter");
  await expect(theme).toHaveValue("system");
  await theme.click();
  await theme.press("Escape");
  await expect(popup).not.toBeVisible();
  await page.screenshot({
    path: "test-results/settings-controls.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("App-Dialoge ersetzen Systemabfragen und stellen den Fokus wieder her", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  const add = page.getByRole("button", { name: "Neues Profil", exact: false });
  await add.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Eingabe").fill("Design-Team");
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(
    page.getByLabel("Profil", { exact: true }).locator("option:checked"),
  ).toHaveText("Design-Team");
  await add.click();
  await dialog.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(add).toBeFocused();
});

test("Dropdown bleibt im modalen Dialog bedienbar, Escape schließt zuerst das Menü", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Zeit nachtragen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const kind = dialog.getByLabel("Eintragsart");
  await kind.click();
  await expect(dialog.getByRole("listbox")).toBeVisible();
  const field = await kind.boundingBox();
  const menu = await dialog.getByRole("listbox").boundingBox();
  expect(Math.abs(menu!.x - field!.x)).toBeLessThan(2);
  expect(Math.abs(menu!.y - (field!.y + field!.height + 6))).toBeLessThan(20);
  await dialog
    .getByRole("listbox")
    .getByRole("option", { name: "Urlaub", exact: true })
    .click();
  await expect(kind).toHaveValue("Urlaub");
  await kind.click();
  await page.screenshot({
    path: "test-results/dialog-dropdown.png",
    fullPage: true,
    animations: "disabled",
  });
  await kind.press("Escape");
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await kind.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("System-Dunkelmodus und reduzierte Bewegung gelten auch für Overlays", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Zeit nachtragen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("animation-name", "none");
  await dialog.getByLabel("Eintragsart").click();
  await expect(page.getByRole("listbox")).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("listbox")).toHaveCSS(
    "background-color",
    "rgb(26, 35, 48)",
  );
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: "test-results/dialog-dark-reduced-motion.png",
    fullPage: true,
    animations: "disabled",
  });
});
