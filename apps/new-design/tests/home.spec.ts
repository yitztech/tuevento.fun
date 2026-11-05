import { expect, test } from "@playwright/test";

test("filtros de diseños: cada etiqueta deja solo sus diseños", async ({ page }) => {
  await page.goto("/");
  const gallery = page.getByRole("region", { name: /invitación tan especial/ });
  await expect(gallery.getByRole("img")).toHaveCount(8);
  await gallery.getByRole("button", { name: "Infantil", exact: true }).click();
  await expect(gallery.getByRole("img")).toHaveCount(1);
  await gallery.getByRole("button", { name: "Todos" }).click();
  await expect(gallery.getByRole("img")).toHaveCount(8);
});

test("carrusel: se mueve con el teclado y con las flechas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const track = page.getByRole("list", { name: "Galería de invitaciones" });
  await track.focus();
  const before = await track.evaluate((e) => e.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => track.evaluate((e) => e.scrollLeft)).toBeGreaterThan(before);
  await page.getByRole("button", { name: "Diseños anteriores" }).click();
  await expect.poll(() => track.evaluate((e) => e.scrollLeft)).toBeLessThan(before + 1000);
});

test("preguntas frecuentes: un acordeón abre una sola respuesta", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("button", { name: "¿Mis invitados necesitan registrarse?" });
  await first.click();
  await expect(page.getByText("Cada invitado abre su enlace privado")).toBeVisible();
  await page.getByRole("button", { name: "¿Puedo organizar más de un evento?" }).click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
});

test("asistencia familiar: cambiar una respuesta actualiza el resumen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("2 de 3 personas asistirán")).toBeVisible();
  await page.getByRole("group", { name: "Respuesta de Leo" }).getByText("Asistiré").click();
  await expect(page.getByText("3 de 3 personas asistirán")).toBeVisible();
  await page.getByRole("group", { name: "Respuesta de Ana" }).getByText("No podré").click();
  await expect(page.getByText("2 de 3 personas asistirán")).toBeVisible();
});

test("newsletter: valida el correo y confirma la simulación", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Suscribirme" }).click();
  await expect(page.getByRole("alert")).toContainText("Escribe un correo válido");
  await page.getByLabel("Correo electrónico").fill("ana@example.com");
  await page.getByRole("button", { name: "Suscribirme" }).click();
  await expect(page.getByRole("status")).toContainText("Listo");
});

test("abrir un diseño desde la portada lo selecciona en la demostración", async ({ page }) => {
  await page.goto("/");
  const gallery = page.getByRole("region", { name: /invitación tan especial/ });
  await gallery.getByRole("link", { name: /Cumpleaños con globos/ }).click();
  await expect(page).toHaveURL(/\/demo\?design=cumpleanos-globos/);
  await expect(page.getByRole("button", { name: /Cumpleaños con globos/ })).toHaveAttribute("aria-pressed", "true");
});


test("las categorías abren la demo con el filtro apropiado", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Cumpleaños Para todas las edades/ }).click();
  await expect(page.getByRole("button", { name: "Cumpleaños", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Cumpleaños con globos/ })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/");
  await page.getByRole("link", { name: /Bautizos Momentos únicos/ }).click();
  await expect(page.getByText("No hay diseños de este estilo todavía.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Personaliza/ })).toBeDisabled();
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeEnabled();
});
