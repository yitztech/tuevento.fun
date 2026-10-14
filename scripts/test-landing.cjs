const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const target = process.env.TEST_WEB_URL || "http://localhost:5187";
// Un idioma por dominio (ver test-browser.cjs): el inglés en el host de SITE_URL_EN.
const englishHost = new URL(
  process.env.TEST_SITE_URL_EN || "https://en.tueventofun.orb.local",
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
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1100 },
    reducedMotion: "reduce",
    locale: "es-ES",
  });
  const page = await context.newPage();
  const errors = [],
    checks = [],
    captures = [],
    userIds = [],
    apiRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/")) apiRequests.push(r.url());
  });
  const shot = async (name) => {
    if (process.env.QA_SKIP_LANDING_CAPTURES) return;
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((i) => i.decode().catch(() => {})),
      );
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    const info = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      failedImages: [...document.images].filter((i) => !i.naturalWidth).length,
    }));
    captures.push({ name, ...info });
    await page.screenshot({
      path: path.join(artifacts, name + ".png"),
      fullPage: true,
    });
    expect(info.overflow).toBe(false);
    expect(info.failedImages).toBe(0);
  };
  try {
    await page.goto(target);
    await expect(
      page.getByRole("heading", {
        name: "Lo bonito es estar juntos.",
        exact: true,
      }),
    ).toBeVisible();
    await shot("landing-desktop");
    expect(apiRequests.filter(url => !url.endsWith("/analytics/visit"))).toEqual([]);
    const footer = page.getByRole("navigation", {
      name: "Enlaces del pie de página",
    });
    await expect(
      footer.getByRole("link", { name: "Privacidad", exact: true }),
    ).toHaveAttribute("href", "/privacidad");
    await expect(
      footer.getByRole("link", { name: "Condiciones", exact: true }),
    ).toHaveAttribute("href", "/condiciones");
    checks.push("Landing pública sin crear sesión; solo telemetría anónima");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("landing-mobile");
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Navegación del sitio" })
      .getByRole("link", { name: "Preguntas frecuentes" })
      .click();
    await expect(
      page.getByRole("button", { name: "Abrir menú", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await page
      .getByText("¿Mis invitados necesitan registrarse?", { exact: true })
      .click();
    await expect(
      page.getByText(
        "No. Abren su enlace privado y responden por cada integrante de la invitación, sin crear una cuenta.",
        { exact: true },
      ),
    ).toBeVisible();
    checks.push("Navegación móvil y preguntas frecuentes accesibles");
    await page.setViewportSize({ width: 768, height: 1024 });
    await shot("landing-tablet");
    await page.setViewportSize({ width: 1512, height: 1100 });
    // El inglés se ofrece como enlace a su dominio; la página no se redirige sola
    expect(new URL(page.url()).origin).toBe(new URL(target).origin);
    await page
      .locator('.landing-header a.language-switcher[hreflang="en"]')
      .first()
      .click();
    // El enlace conserva la ruta, la query y el ancla actuales (aquí #preguntas)
    await page.waitForURL(
      (url) => url.origin === new URL(targetEn).origin && url.pathname === "/",
    );
    await expect(
      page.getByRole("heading", { name: "The joy is being together." }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle(
      "TuEventoFun · Invite, gather and celebrate",
    );
    await expect(
      page
        .getByRole("navigation", { name: "Footer links" })
        .getByRole("link", { name: "Privacy", exact: true }),
    ).toHaveAttribute("href", "/privacy");
    const canonical = page.locator('link[rel="canonical"]');
    if (await canonical.count())
      await expect(canonical).toHaveAttribute("href", `${targetEn}/`);
    await shot("landing-en-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("landing-en-mobile");
    await page.setViewportSize({ width: 1512, height: 1100 });
    checks.push(
      "Landing en el dominio inglés: textos, título, idioma HTML y enlaces legales",
    );
    await page
      .getByRole("group", { name: "Reply from Leo" })
      .getByRole("button", { name: "Attending", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "3 of 3 people are attending",
    );
    await page
      .getByRole("group", { name: "Reply from Ana" })
      .getByRole("button", { name: "Not attending", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "2 of 3 people are attending",
    );
    expect(apiRequests.filter(url => !url.endsWith("/analytics/visit"))).toEqual([]);
    checks.push(
      "RSVP de ejemplo interactivo cambia el conteo sin escribir en un evento",
    );
    await page
      .getByRole("group", { name: "Choose a sample design" })
      .getByRole("button", { name: "Tropical", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Create with this design" }),
    ).toHaveAttribute("href", "/registro?tema=tropical");
    await expect(
      page.locator(".landing-invitation-preview img"),
    ).toHaveAttribute("src", "/images/tropical.jpg");
    await page.getByRole("link", { name: "Create with this design" }).click();
    await expect(page).toHaveURL(/\/registro\?tema=tropical$/);
    const unique = Date.now(),
      password = crypto.randomBytes(20).toString("hex"),
      email = `landing-${unique}@example.invalid`;
    await page.getByLabel("First name", { exact: true }).fill("Paula");
    await page.getByLabel("Last name", { exact: true }).fill("Landing");
    await page
      .getByLabel("Phone number", { exact: true })
      .fill("+527771234567");
    await page
      .getByLabel("Username", { exact: true })
      .fill(`landing_${unique}`);
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create my account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/eventos\/nuevo\?tema=tropical$/);
    await expect(
      page.getByRole("button", { name: "Tropical", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // Desde la página: el host inglés solo lo resuelve Chromium (--host-resolver-rules)
    const created = await page.evaluate(() =>
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()),
    );
    userIds.push(created.id);
    // La cuenta guarda el idioma del dominio donde se registró
    expect(created.locale).toBe("en");
    checks.push(
      "CTA de diseño crea una cuenta real en inglés y conserva Tropical al abrir el editor",
    );
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Overview", exact: true })
      .click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("heading", { name: "Your next story starts here" }),
    ).toBeVisible();
    checks.push(
      "Panel en /app accesible después de la captación, con cuenta vacía",
    );
    await page.goto(targetEn);
    await page
      .getByRole("link", { name: "Create my first event", exact: true })
      .click();
    await expect(page).toHaveURL(/\/registro\?empezar=evento$/);
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/acceso\?empezar=evento$/);
    await expect(
      page.getByRole("heading", { name: "It's good to see you again." }),
    ).toBeVisible();
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Sign in to my space", exact: true })
      .click();
    await expect(page).toHaveURL(/\/eventos\/nuevo$/);
    checks.push(
      "CTA principal y acceso existente conservan la intención de crear un evento",
    );
    const demoContext = await browser.newContext({
      viewport: { width: 1512, height: 1100 },
      reducedMotion: "reduce",
    });
    const demo = await demoContext.newPage();
    demo.on("pageerror", (e) => errors.push(e.message));
    await demo.goto(target);
    await demo
      .getByRole("link", { name: "Ver la demostración", exact: true })
      .click();
    await expect(demo).toHaveURL(/\/app$/);
    await expect(
      demo.getByRole("heading", { name: "La vida se celebra juntos." }),
    ).toBeVisible();
    await expect(
      demo.getByText(
        "Estás explorando una demostración. Los eventos y sus datos son de ejemplo.",
      ),
    ).toBeVisible();
    await demoContext.close();
    checks.push("CTA de demostración abre el panel aislado sin registro");
    expect(errors).toEqual([]);
    fs.writeFileSync(
      path.join(artifacts, "landing-results.json"),
      JSON.stringify(
        { checks, errors, captures, date: new Date().toISOString() },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ checks, errors, captures }, null, 2));
  } catch (e) {
    await page.screenshot({
      path: path.join(artifacts, "landing-failure.png"),
      fullPage: true,
    });
    console.error(e);
    console.log("PAGE", await page.locator("body").innerText());
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (!process.env.TEST_WEB_URL) {
      for (const id of userIds)
        if (/^[0-9a-f-]{36}$/.test(id))
          execFileSync(
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
              `DELETE FROM users WHERE id='${id}' AND email LIKE 'landing-%@example.invalid'`,
            ],
            { stdio: "ignore" },
          );
    }
  }
})();
