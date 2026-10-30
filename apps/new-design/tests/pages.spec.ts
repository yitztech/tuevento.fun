import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = { "/": "Lo bonito es", "/login": "Bienvenido de vuelta", "/registro": "Crea tu cuenta", "/recuperar-contrasena": "Recupera tu contraseña", "/proveedores": "Proveedores para cada ocasión", "/demo": "Descubre cómo funciona TuEventoFun" };
const sizes = [[320, 700], [375, 812], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]];

for (const [path, heading] of Object.entries(pages)) {
  test.describe(path, () => {
    test("carga con su título principal", async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading.replace(/\s+/g, " ").split(" ")[0]);
    });

    test("sin desbordamiento horizontal ni imágenes rotas en los nueve tamaños", async ({ page }) => {
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.goto(path, { waitUntil: "networkidle" });
        const r = await page.evaluate(async () => {
          for (const i of document.images) i.loading = "eager";
          await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((res) => { i.onload = i.onerror = res; }))));
          return { over: document.documentElement.scrollWidth - innerWidth, broken: [...document.images].filter((i) => i.naturalWidth === 0).length };
        });
        expect(r.over, `${path} a ${width}px`).toBeLessThanOrEqual(0);
        expect(r.broken, `${path} a ${width}px`).toBe(0);
      }
    });

    test("pasa axe (WCAG 2 A y AA)", async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    });
  });
}

test("la navegación enlaza las seis rutas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Proveedores" }).click();
  await expect(page).toHaveURL(/\/proveedores$/);
  await page.getByRole("link", { name: "Entrar", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Crear una cuenta" }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await page.getByRole("link", { name: "Entrar", exact: true }).last().click();
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/recuperar-contrasena$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Ver la demostración" }).click();
  await expect(page).toHaveURL(/\/demo$/);
});

test("una ruta desconocida muestra la página 404", async ({ page }) => {
  await page.goto("/no-existe");
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
});

test("menú móvil: abre, navega y se cierra con Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Abrir menú" });
  await toggle.click();
  await expect(page.getByRole("link", { name: "Proveedores" }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.getByRole("link", { name: "Proveedores" }).first().click();
  await expect(page).toHaveURL(/\/proveedores$/);
});
