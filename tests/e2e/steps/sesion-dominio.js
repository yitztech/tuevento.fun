import { When } from "./fixtures.js";

When("escribo mi correo y mi contraseña en inglés", async ({ page, ctx }) => {
  await page.getByLabel("Email address", { exact: true }).fill(ctx.cuenta.email);
  await page.getByLabel("Password", { exact: true }).fill(ctx.cuenta.password);
});

When("envío el formulario de acceso en inglés", async ({ page }) => {
  await page.getByRole("button", { name: "Sign in to my space", exact: true }).click();
});
