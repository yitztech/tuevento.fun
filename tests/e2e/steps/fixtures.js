import { test as base, createBdd } from "playwright-bdd";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { _android } from "@playwright/test";
import { teclado, pausa, android, ios } from "../support/entorno.js";
import { uiPlaywright } from "../support/ui-playwright.js";
import { uiIos, conectarIos, reiniciarApp, simuladorArrancado } from "../support/ui-ios.js";

/** Datos de una cuenta válida y única, para no depender del estado de la base de datos. */
export function nuevaCuenta(extra = {}) {
  const unico = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  return {
    firstName: "Paula",
    lastName: "Prueba",
    email: `e2e-${unico}@example.invalid`,
    phone: "+527771234567",
    password: randomBytes(12).toString("hex"),
    ...extra,
  };
}

/** Navega a una ruta de la app: URL en la web, hash (#/ruta) dentro de la app nativa. */
async function abrirRuta(page, ruta) {
  if (!android) return page.goto(ruta);
  await page.evaluate((r) => { window.location.hash = `#${r}`; }, ruta);
}

const comunes = {
  /** Estado compartido entre los pasos de un mismo escenario. */
  ctx: async ({}, use) => use({}),
  /** Con E2E_PAUSA, deja el resultado a la vista unos segundos antes de cerrar el escenario. */
  verResultado: [
    async ({ ui }, use) => {
      await use();
      if (pausa) await ui.pausar(pausa);
    },
    { auto: true },
  ],
};

// Web: el `page` de Playwright.
const conWeb = {
  ui: async ({ page }, use) => use(uiPlaywright(page, { abrir: (ruta) => abrirRuta(page, ruta), teclado })),
};

// Android: el WebView de la app instalada en el emulador (E2E_TARGET=android, ver
// docs/E2E.md); no se abre ningún navegador adicional.
const paquete = "com.tueventofun.app.pruebas";
const adb = join(process.env.ANDROID_HOME || join(homedir(), "Library/Android/sdk"), "platform-tools/adb");
const conAndroid = {
  dispositivo: [
    async ({}, use) => {
      const [device] = await _android.devices();
      if (!device) throw new Error("No hay emulador de Android: bash scripts/mobile-test-android.sh");
      execFileSync(adb, ["reverse", "tcp:8443", "tcp:8443"]);
      await use(device);
      await device.close();
    },
    { scope: "worker" },
  ],
  page: async ({ dispositivo }, use, testInfo) => {
    // Estado limpio en cada escenario: sin sesión ni datos, en español, app recién abierta.
    await dispositivo.shell(`pm clear ${paquete}`);
    await dispositivo.shell(`cmd locale set-app-locales ${paquete} --locales es-ES`);
    await dispositivo.shell(`monkey -p ${paquete} -c android.intent.category.LAUNCHER 1`);
    const page = await (await dispositivo.webView({ pkg: paquete }, { timeout: 30_000 })).page();
    await page.waitForLoadState("domcontentloaded");
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus)
      await testInfo.attach("pantalla-emulador", {
        body: await dispositivo.screenshot(),
        contentType: "image/png",
      });
  },
  ui: conWeb.ui,
};

// iOS: el WebView de la app instalada en el simulador, conducido con Appium (XCUITest).
// Playwright no maneja iOS, así que `page` no existe aquí: los pasos usan solo `ui`.
const rutaAppIos = resolve("../mobile/.build/ios/Build/Products/Debug-iphonesimulator/App.app");
const conIos = {
  udid: [async ({}, use) => use(simuladorArrancado()), { scope: "worker" }],
  driver: [
    async ({ udid }, use) => {
      const driver = await conectarIos(udid);
      await use(driver);
      await driver.deleteSession().catch(() => {});
    },
    { scope: "worker" },
  ],
  ui: async ({ driver }, use, testInfo) => {
    await reiniciarApp(driver, rutaAppIos);
    await use(uiIos(driver, { teclado }));
    if (testInfo.status !== testInfo.expectedStatus)
      await testInfo.attach("pantalla-simulador", {
        body: Buffer.from(await driver.takeScreenshot(), "base64"),
        contentType: "image/png",
      });
  },
};

export const test = base.extend({ ...comunes, ...(ios ? conIos : android ? conAndroid : conWeb) });

export const { Given, When, Then } = createBdd(test);
