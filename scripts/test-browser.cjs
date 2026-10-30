const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const target = process.env.TEST_WEB_URL || "http://localhost:5187";
// Un idioma por dominio: el inglés vive en el host de SITE_URL_EN. Contra localhost
// se usa ese host en el mismo puerto y Chromium lo resuelve a 127.0.0.1, así la
// prueba no depende de DNS (CI) y el gateway recibe el Host inglés.
const englishHost = new URL(
  process.env.TEST_SITE_URL_EN || "http://yourevent.localhost:5187",
).hostname;
const local = /^(localhost|127\.0\.0\.1)$/.test(new URL(target).hostname);
const targetEn =
  process.env.TEST_WEB_URL_EN ||
  (local
    ? `http://${englishHost}:${new URL(target).port || 80}`
    : `https://${englishHost}`);
const artifacts = path.resolve("qa-artifacts");
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADED !== "1",
    args: local ? [`--host-resolver-rules=MAP ${englishHost} 127.0.0.1`] : [],
  });
  // El navegador pide español: el dominio inglés debe responder en inglés igualmente.
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1100 },
    reducedMotion: "reduce",
    locale: "es-ES",
    permissions: ["clipboard-read", "clipboard-write"],
    ignoreHTTPSErrors: true,
  });
  let createdUser;
  const page = await context.newPage();
  const errors = [],
    checks = [],
    overflow = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = async (name, fullPage = true) => {
    if (
      process.env.QA_SKIP_BASE &&
      [
        "dashboard-desktop",
        "dashboard-mobile",
        "templates-mobile",
        "templates-desktop",
      ].includes(name)
    )
      return;
    await page.evaluate(async () => {
      await document.fonts.ready;
      // Con loading="lazy", las imágenes fuera de pantalla no se cargan y decode() no termina
      await Promise.all(
        Array.from(document.images).map((i) => {
          i.loading = "eager";
          return i.decode().catch(() => {});
        }),
      );
    });
    overflow.push({
      name,
      width: await page.evaluate(() => window.innerWidth),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    await page.screenshot({
      path: path.join(artifacts, name + ".png"),
      fullPage,
    });
  };
  try {
    // Sin sesión, /app no abre la demostración: pide acceder primero
    await page.goto(target + "/app");
    await expect(page).toHaveURL(/\/acceso$/);
    // La demostración exige una cuenta registrada: el script se registra y abre la demo desde la página
    for (const origen of [target, targetEn]) {
      await page.goto(origen + "/acceso");
      const estado = await page.evaluate(async () => {
        const cabeceras = { "content-type": "application/json", "x-tuevento-client": "1" };
        const cuenta = {
          firstName: "Prueba",
          lastName: "Automática",
          email: `navegador-${Date.now()}@example.invalid`,
          phone: "+527771234567",
          password: "clave-navegador-1",
        };
        await fetch("/api/auth/register", { method: "POST", headers: cabeceras, body: JSON.stringify(cuenta) });
        const demo = await fetch("/api/auth/demo", { method: "POST", headers: { "x-tuevento-client": "1" } });
        return demo.status;
      });
      expect(estado).toBe(201);
    }
    await page.goto(target + "/app");
    await expect(
      page.getByRole("heading", { name: "La vida se celebra juntos." }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "La boda de Sofía & Alejandro" }),
    ).toBeVisible();
    await shot("dashboard-desktop");
    checks.push("Demostración con eventos y métricas persistidas");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    // El otro idioma es un enlace a su dominio, nunca una redirección
    const toEnglish = page.locator('a.language-option[hreflang="en"]').first();
    await expect(toEnglish).toHaveAttribute("href", `${targetEn}/app`);
    expect(new URL(page.url()).origin).toBe(new URL(target).origin);
    // Con varios idiomas el selector es un menú: se abre y se elige el inglés
    await page.locator("summary.language-switcher").first().click();
    await toEnglish.click();
    await page.waitForURL(`${targetEn}/app`);
    await expect(
      page.getByRole("heading", {
        name: "Life is better celebrated together.",
      }),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Life is better celebrated together.",
      }),
    ).toBeVisible();
    await expect(
      page.locator('a.language-option[hreflang="es"]').first(),
    ).toHaveAttribute("href", `${target}/app`);
    await shot("dashboard-en-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("dashboard-en-mobile");
    await page.setViewportSize({ width: 1512, height: 1100 });
    await page.goto(target + "/app");
    await expect(
      page.getByRole("heading", { name: "La vida se celebra juntos." }),
    ).toBeVisible();
    checks.push(
      "Idioma por dominio con navegador en español; enlace al otro dominio sin redirección",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await shot("dashboard-mobile");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(
      page.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Diseños de invitación" }).click();
    await expect(
      page.getByRole("heading", { name: "Invitaciones con personalidad." }),
    ).toBeVisible();
    await shot("templates-mobile");
    await page.setViewportSize({ width: 1512, height: 1100 });
    await shot("templates-desktop");
    await page
      .getByRole("button", { name: "Vista previa de Bodas Florales" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    checks.push("Navegación móvil y seis diseños con vista previa");
    await page.goto(target + "/registro");
    await page
      .getByRole("button", { name: "Crear mi cuenta", exact: true })
      .click();
    await expect(
      page.getByText("Escribe al menos 2 caracteres.").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Condiciones de uso" }),
    ).toHaveAttribute("href", "/condiciones");
    const english = await context.newPage();
    english.on("pageerror", (e) => errors.push(e.message));
    await english.goto(targetEn + "/registro");
    await english
      .getByRole("button", { name: "Create my account", exact: true })
      .click();
    await expect(
      english.getByText("Enter at least 2 characters.").first(),
    ).toBeVisible();
    await expect(
      english.getByLabel("Email address", { exact: true }),
    ).toBeVisible();
    await expect(
      english.getByRole("link", { name: "Terms of use" }),
    ).toHaveAttribute("href", "/terms");
    checks.push("Registro y validaciones en inglés en el dominio inglés");
    await english.goto(targetEn + "/privacy");
    await expect(
      english.getByRole("heading", { name: "Privacy policy" }),
    ).toBeVisible();
    await english.goto(targetEn + "/terms");
    await expect(
      english.getByRole("heading", { name: "Terms of use" }),
    ).toBeVisible();
    await english.goto(target + "/privacidad");
    await expect(
      english.getByRole("heading", { name: "Aviso de privacidad" }),
    ).toBeVisible();
    // La ruta inglesa en el dominio español muestra el texto en español
    await english.goto(target + "/privacy");
    await expect(
      english.getByRole("heading", { name: "Aviso de privacidad" }),
    ).toBeVisible();
    const canonical = english.locator('link[rel="canonical"]');
    if (await canonical.count())
      await expect(canonical).toHaveAttribute("href", /\/privacidad$/);
    await english.goto(target + "/condiciones");
    await expect(
      english.getByRole("heading", { name: "Condiciones de uso" }),
    ).toBeVisible();
    checks.push("Privacidad y condiciones en cada dominio y su idioma");
    const unique = Date.now(),
      email = `ui-${unique}@example.invalid`,
      password = crypto.randomBytes(20).toString("hex");
    await page.getByLabel("Nombre(s)", { exact: true }).fill("Paula");
    await page.getByLabel("Apellido(s)", { exact: true }).fill("Prueba");
    await page.getByLabel("Teléfono", { exact: true }).fill("+527771234567");
    await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByLabel("Cargar avatar de registro")
      .setInputFiles(path.resolve("apps/web/public/images/gold.jpg"));
    await page
      .getByRole("button", { name: "Crear mi cuenta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu próxima historia empieza aquí" }),
    ).toBeVisible();
    checks.push(
      "Registro con validación y carga de avatar; cuenta inicia vacía",
    );
    const me = await context.request.get(target + "/api/auth/me");
    const user = await me.json();
    createdUser = user.id;
    fs.appendFileSync(
      path.join(artifacts, "browser-users.jsonl"),
      JSON.stringify({ id: user.id }) + "\n",
    );
    await page.getByRole("link", { name: "Crear evento", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Hay algo que celebrar." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Crear mi evento" }).click();
    await expect(page.getByText("Elige una fecha y hora.")).toBeVisible();
    await page
      .getByLabel("Nombre del evento", { exact: true })
      .fill("Fiesta de prueba QA");
    await page
      .getByLabel("Fecha y hora", { exact: true })
      .fill("2026-12-20T17:00");
    await page
      .getByLabel("¿Dónde nos vemos?", { exact: true })
      .fill("Jardín de pruebas");
    await page
      .getByLabel("Un mensaje para tus invitados", { exact: true })
      .fill("Nos encantará compartir este día. Datos de prueba.");
    await page.getByRole("button", { name: "Tropical", exact: true }).click();
    await shot("event-editor-desktop");
    // El editor en inglés, con la sesión de demostración del dominio inglés
    await english.goto(targetEn + "/eventos/nuevo");
    await expect(
      english.getByLabel("Date and time", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await english
      .getByLabel("Event name", { exact: true })
      .fill("Fiesta de prueba QA");
    await english.evaluate(() => document.fonts.ready);
    await english.screenshot({
      path: path.join(artifacts, "event-editor-en.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Crear mi evento" }).click();
    await expect(
      page.getByRole("heading", { name: "Fiesta de prueba QA" }),
    ).toBeVisible();
    await page.waitForURL(/\/eventos\/[0-9a-f-]{36}$/);
    const eventUrl = page.url();
    checks.push("Crear evento y cambiar diseño con vista previa");
    await page.getByRole("button", { name: "Añadir invitación" }).click();
    await page.getByRole("button", { name: /Familiar o grupal/ }).click();
    await page
      .getByLabel("Nombre de la invitación", { exact: true })
      .fill("Familia Prueba");
    await page
      .getByLabel("Correo de contacto (opcional)", { exact: true })
      .fill("familia@example.invalid");
    await page
      .getByLabel("Teléfono (opcional)", { exact: true })
      .fill("+527771234500");
    await page.getByLabel("Nombre", { exact: true }).fill("Ana Prueba");
    await page
      .getByLabel("Notas individuales (opcional)", { exact: true })
      .fill("Alergia privada");
    await page.getByRole("button", { name: "Añadir integrante" }).click();
    await page.getByLabel("Nombre", { exact: true }).nth(1).fill("Leo Prueba");
    await page.getByLabel("Tipo", { exact: true }).nth(1).selectOption("child");
    await page
      .getByLabel("Notas individuales (opcional)", { exact: true })
      .nth(1)
      .fill("Sin nueces");
    await page
      .getByRole("button", { name: "Crear invitación", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Familia Prueba", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Editar Familia Prueba" }).click();
    await page.getByRole("button", { name: "Añadir integrante" }).click();
    await page.getByLabel("Nombre", { exact: true }).nth(2).fill("Luz Prueba");
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    checks.push("Crear y editar familia con adultos, niño y notas");
    await page
      .getByRole("button", { name: "Compartir invitación de Familia Prueba" })
      .click();
    const link = await page
      .getByLabel("Enlace privado de invitación")
      .inputValue();
    // El enlace usa el dominio actual y no lleva idioma en la query
    expect(link.startsWith(`${target}/i/`)).toBe(true);
    expect(link).not.toContain("lang=");
    await page
      .getByRole("button", { name: "Copiar enlace", exact: true })
      .click();
    await expect(page.locator("[data-sonner-toast]")).toContainText("Enlace copiado.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      link,
    );
    expect(
      await page
        .getByRole("link", { name: "Correo electrónico", exact: true })
        .getAttribute("href"),
    ).toContain("mailto:familia@example.invalid");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    checks.push("Enlace único, portapapeles y correo precompuesto");
    const guestContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      ignoreHTTPSErrors: true,
    });
    const guest = await guestContext.newPage();
    guest.on("pageerror", (e) => errors.push(e.message));
    await guest.goto(link);
    await expect(
      guest.getByRole("heading", { name: "Sin ti, no es lo mismo." }),
    ).toBeVisible();
    await expect(guest.getByText("Alergia privada")).not.toBeVisible();
    await guest
      .getByRole("group", { name: "Ana Prueba Adulto" })
      .getByRole("button", { name: "¡Sí, asistiré!" })
      .click();
    await guest
      .getByRole("group", { name: "Leo Prueba Niño" })
      .getByRole("button", { name: "No podré ir" })
      .click();
    await guest
      .getByRole("button", { name: "Guardar mi respuesta", exact: true })
      .click();
    await expect(guest.getByText("¡Tu respuesta está guardada!")).toBeVisible();
    await guest.evaluate(() => document.fonts.ready);
    await guest.screenshot({
      path: path.join(artifacts, "rsvp-mobile.png"),
      fullPage: true,
    });
    // El mismo enlace en el dominio inglés muestra la invitación en inglés
    await guest.goto(link.replace(target, targetEn));
    await expect(
      guest.getByRole("heading", {
        name: "It wouldn't be the same without you.",
      }),
    ).toBeVisible();
    await expect(
      guest.getByRole("button", { name: "Save my reply", exact: true }),
    ).toBeVisible();
    await expect(guest.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      guest.getByRole("heading", { name: "Fiesta de prueba QA" }),
    ).toBeVisible();
    await guest.screenshot({
      path: path.join(artifacts, "rsvp-en-mobile.png"),
      fullPage: true,
    });
    // El enlace personal lleva a la landing del evento; el selector cambia de dominio sin salir de ella
    await expect(guest).toHaveURL(new RegExp(`^${targetEn}/[a-z0-9]{8}/[a-z0-9-]+$`));
    await expect(
      guest.locator('a.language-option[hreflang="es"]').first(),
    ).toHaveAttribute("href", guest.url().replace(targetEn, target));
    await guest.goto(link);
    await expect(
      guest.getByRole("button", { name: "Guardar mi respuesta", exact: true }),
    ).toBeVisible();
    checks.push(
      "Invitación pública en ambos dominios con el mismo enlace y contenido original",
    );
    await expect(
      page
        .locator(".stat")
        .filter({ hasText: "Confirmados" })
        .locator("strong"),
    ).toHaveText("1", { timeout: 6000 });
    await expect(
      page
        .locator(".stat")
        .filter({ hasText: "No asistirán" })
        .locator("strong"),
    ).toHaveText("1");
    await expect(
      page.locator(".stat").filter({ hasText: "En espera" }).locator("strong"),
    ).toHaveText("1");
    checks.push(
      "RSVP sin registro por integrante y actualización SSE visible sin recarga",
    );
    await shot("event-detail-desktop");
    await page
      .getByRole("radio", { name: "Confirmados", exact: false })
      .click();
    await expect(
      page.getByRole("button", { name: "Familia Prueba", exact: true }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Todos", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("event-detail-mobile");
    await page.setViewportSize({ width: 768, height: 1024 });
    await shot("event-detail-tablet");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole("link", { name: "Modo pantalla" }).click();
    await shot("tv-1920");
    await page.getByRole("button", { name: "Pantalla completa" }).click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBeTruthy();
    await page.getByRole("button", { name: "Pantalla completa" }).click();
    await page.getByRole("link", { name: "Volver al evento" }).click();
    checks.push("Filtros de asistencia, tablet y modo pantalla a 1920 px");
    await page.setViewportSize({ width: 1512, height: 1100 });
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /Notificaciones/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Familia Prueba" }),
    ).toBeVisible();
    await expect(
      page.getByText("1 confirmado, 1 no asistirá y 1 en espera."),
    ).toBeVisible();
    // Sesión por dominio: en el dominio inglés hay que entrar con la misma cuenta
    await english.goto(targetEn + "/acceso");
    await english.getByLabel("Email address", { exact: true }).fill(email);
    await english.getByLabel("Password", { exact: true }).fill(password);
    await english
      .getByRole("button", { name: "Sign in to my space", exact: true })
      .click();
    await expect(
      english.getByRole("heading", { name: "Fiesta de prueba QA" }),
    ).toBeVisible();
    await english.goto(targetEn + "/notificaciones");
    await expect(
      english.getByText("1 attending, 1 not attending and 1 pending."),
    ).toBeVisible();
    checks.push(
      "Notificaciones en el idioma del dominio; sesión independiente por dominio",
    );
    await page
      .getByRole("button", { name: "Marcar todas como leídas" })
      .click();
    await expect(
      page.getByRole("radio", { name: "Sin leer (0)" }),
    ).toBeVisible();
    checks.push("Notificación de respuesta y marcado como leída");
    await page.goto(eventUrl);
    await page.getByRole("button", { name: "Editar Familia Prueba" }).click();
    await page.getByRole("button", { name: "Eliminar integrante 3" }).click();
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page
        .locator(".stat")
        .filter({ hasText: "Personas invitadas" })
        .locator("strong"),
    ).toHaveText("2");
    checks.push("Eliminar integrante recalcula métricas");
    await page
      .getByRole("link", { name: "Editar evento", exact: true })
      .click();
    await page
      .getByLabel("Nombre del evento", { exact: true })
      .fill("Fiesta de prueba editada");
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fiesta de prueba editada" }),
    ).toBeVisible();
    checks.push("Edición del evento persiste");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(
      page.getByRole("heading", { name: "Qué bueno verte de nuevo." }),
    ).toBeVisible();
    await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Entrar a mi espacio", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fiesta de prueba editada" }),
    ).toBeVisible();
    checks.push("Cerrar e iniciar sesión conserva el evento");
    expect(errors).toEqual([]);
    expect(overflow.filter((v) => v.overflow)).toEqual([]);
    fs.writeFileSync(
      path.join(artifacts, "browser-results.json"),
      JSON.stringify(
        { checks, errors, overflow, date: new Date().toISOString() },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ checks, errors, overflow }, null, 2));
    await guestContext.close();
  } catch (e) {
    await page.screenshot({
      path: path.join(artifacts, "browser-failure.png"),
      fullPage: true,
    });
    console.error(e);
    console.log("PAGE", await page.locator("body").innerText());
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (
      createdUser &&
      !process.env.TEST_WEB_URL &&
      /^[0-9a-f-]{36}$/.test(createdUser)
    ) {
      require("node:child_process").execFileSync(
        "docker",
        [
          "compose",
          "exec",
          "-T",
          "postgres",
          "psql",
          "-U",
          "tuevento",
          "-d",
          "tueventofun",
          "-c",
          `DELETE FROM users WHERE id='${createdUser}' AND email LIKE 'ui-%@example.invalid'`,
        ],
        { stdio: "ignore" },
      );
    }
  }
})();
