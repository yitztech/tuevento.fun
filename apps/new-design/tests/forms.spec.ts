import { expect, test } from "@playwright/test";

test.describe("login", () => {
  test("campos vacíos muestran errores por campo", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Este campo es obligatorio.")).toHaveCount(2);
    await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
  });

  test("correo inválido, mostrar contraseña y error genérico al enviar", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("no-es-correo");
    await page.getByLabel("Contraseña", { exact: true }).fill("secreto123");
    await page.getByRole("button", { name: "Mostrar contraseña" }).click();
    await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Escribe un correo válido")).toBeVisible();
    await page.getByLabel("Correo electrónico").fill("ana@example.com");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("No pudimos iniciar sesión");
  });

  test("los accesos con Google y Apple están desactivados", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Google" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Apple" })).toBeDisabled();
  });
});

test.describe("registro", () => {
  test("valida nombre, contraseña corta y términos", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Ana123");
    await page.getByLabel("Correo electrónico").fill("ana@example.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("corta");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.getByText("Usa solo letras, espacios, apóstrofos o guiones.")).toBeVisible();
    await expect(page.getByText("al menos 8 caracteres")).toBeVisible();
    await expect(page.getByText("Debes aceptar los términos")).toBeVisible();
  });

  test("con datos válidos confirma la simulación", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Ana María O'Neil-Pérez");
    await page.getByLabel("Correo electrónico").fill("ana@example.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("una-clave-larga");
    await page.getByRole("checkbox", { name: /Acepto los/ }).click();
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cuenta de demostración" })).toBeVisible();
  });

  test("el nombre respeta el máximo de 100 caracteres", async ({ page }) => {
    await page.goto("/registro");
    await expect(page.getByLabel("Nombre completo")).toHaveAttribute("maxlength", "100");
    await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("maxlength", "254");
  });
});

test.describe("recuperar contraseña", () => {
  test("da el mismo mensaje sin revelar si la cuenta existe", async ({ page }) => {
    await page.goto("/recuperar-contrasena");
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByText("Este campo es obligatorio.")).toBeVisible();
    await page.getByLabel("Correo electrónico").fill("cualquiera@example.com");
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByText(/Si cualquiera@example.com tiene una cuenta/)).toBeVisible();
    await page.getByRole("button", { name: "Usar otro correo" }).click();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al inicio de sesión" })).toBeVisible();
  });
});
