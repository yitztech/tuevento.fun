import { expect } from "@playwright/test";
import { When, Then } from "./fixtures.js";

When("elijo editar mi información", async ({ ui }) => {
  await ui.pulsar("Editar información");
});

When("cancelo la edición del perfil", async ({ ui }) => {
  await ui.pulsar("Cancelar");
});

// Solo web: los escenarios que los usan no llevan @movil
Then("el campo {string} no se puede editar", async ({ page }, campo) => {
  await expect(page.getByLabel(campo, { exact: true })).not.toBeEditable();
});

Then("el campo {string} se puede editar", async ({ page }, campo) => {
  await expect(page.getByLabel(campo, { exact: true })).toBeEditable();
});

Then("veo la acción {string}", async ({ page }, nombre) => {
  await expect(page.getByRole("button", { name: nombre, exact: true })).toBeVisible();
});

Then("no veo la acción {string}", async ({ page }, nombre) => {
  await expect(page.getByRole("button", { name: nombre, exact: true })).toHaveCount(0);
});
