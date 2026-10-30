import { expect, test } from "@playwright/test";

test.describe("proveedores", () => {
  test("filtra por categoría y por búsqueda, y se puede limpiar", async ({ page }) => {
    await page.goto("/proveedores");
    await expect(page.getByText("8 proveedores")).toBeVisible();
    await page.getByRole("button", { name: "Catering y banquetes" }).click();
    await expect(page.getByText("1 proveedor", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Banquetes y buffet" })).toBeVisible();
    await page.getByRole("button", { name: "Todas" }).click();
    await page.getByRole("searchbox", { name: "Buscar servicios" }).fill("fotografía");
    await expect(page.getByRole("heading", { name: "Fotografía de eventos" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar servicios" }).fill("zzzz");
    await expect(page.getByText("No encontramos proveedores")).toBeVisible();
    await page.getByRole("button", { name: "Quitar filtros" }).click();
    await expect(page.getByText("8 proveedores")).toBeVisible();
  });

  test("las tarjetas dicen que son ejemplos y no muestran valoraciones", async ({ page }) => {
    await page.goto("/proveedores");
    await expect(page.getByText("Perfil de ejemplo")).toHaveCount(8);
    await expect(page.getByText(/★|\(\d+\)/)).toHaveCount(0);
  });
});

test.describe("demo", () => {
  test("recorre los cuatro pasos: diseño, detalles, compartir y respuestas", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByText("Esto es una simulación")).toBeVisible();
    await page.getByRole("button", { name: "Cumpleaños con globos" }).click();
    await expect(page.getByRole("button", { name: "Cumpleaños con globos" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await page.getByLabel("Nombre del evento").fill("");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Escribe el nombre del evento.")).toBeVisible();
    await page.getByLabel("Nombre del evento").fill("Fiesta de Leo");
    await expect(page.getByRole("img", { name: /Vista previa de la invitación/ })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await page.getByRole("button", { name: "WhatsApp" }).click();
    await expect(page.getByText("Simulación: así se enviaría por WhatsApp")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByText("2 de 3 personas asistirán")).toBeVisible();
    await page.getByRole("group", { name: "Respuesta de Leo" }).getByText("Asistiré").click();
    await expect(page.getByText("3 de 3 personas asistirán")).toBeVisible();
    await expect(page.getByRole("link", { name: /Crear mi evento/ })).toHaveAttribute("href", "/registro");
    await page.getByRole("button", { name: "Volver a empezar" }).click();
    await expect(page.getByRole("heading", { name: "1. Elige un diseño" })).toBeVisible();
  });

  test("el selector de pasos permite saltar y marca el paso actual", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: "Comparte" }).click();
    await expect(page.getByRole("button", { name: "Comparte" })).toHaveAttribute("aria-current", "step");
  });
});
