import { execFileSync } from "node:child_process";
import { remote } from "webdriverio";

export const bundleIos = "com.tueventofun.app.pruebas";
const espera = { timeout: 8000, interval: 150 };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const literal = (s) => (s.includes('"') ? `concat("${s.split('"').join('", \'"\', "')}")` : `"${s}"`);
const xCampo = (etiqueta) => `//input[@id=//label[normalize-space(.)=${literal(etiqueta)}]/@for]`;

/**
 * Simulador de iOS arrancado: E2E_IOS_UDID, o el que se llame E2E_IOS_SIMULADOR (p. ej.
 * "iPad Pro 13-inch (M5)"), o el primer iPhone. Se prepara con scripts/mobile-test-ios.sh.
 */
export function simuladorArrancado() {
  if (process.env.E2E_IOS_UDID) return process.env.E2E_IOS_UDID;
  const lista = JSON.parse(execFileSync("xcrun", ["simctl", "list", "devices", "booted", "-j"]));
  const arrancados = Object.values(lista.devices).flat();
  const nombre = process.env.E2E_IOS_SIMULADOR;
  const elegido = nombre ? arrancados.find((d) => d.name === nombre) : arrancados.find((d) => d.name.startsWith("iPhone"));
  if (!elegido) throw new Error(`No hay simulador de iOS arrancado${nombre ? ` llamado "${nombre}"` : ""}: bash scripts/mobile-test-ios.sh`);
  return elegido.udid;
}

export async function conectarIos(udid) {
  return remote({
    hostname: "127.0.0.1",
    port: 4723,
    logLevel: "warn",
    connectionRetryTimeout: 600_000,
    capabilities: {
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:udid": udid,
      "appium:bundleId": bundleIos,
      "appium:noReset": true,
      "appium:wdaLaunchTimeout": 600_000,
      "appium:webviewConnectTimeout": 30_000,
      // El inspector del simulador publica la app como "process-App".
      "appium:additionalWebviewBundleIds": ["process-App"],
    },
  });
}

/** Deja la app recién instalada (sin sesión ni datos) y entra a su WebView. */
export async function reiniciarApp(driver, rutaApp) {
  await driver.removeApp(bundleIos).catch(() => {});
  await driver.installApp(rutaApp);
  await driver.activateApp(bundleIos);
  await driver.waitUntil(
    async () => {
      const web = (await driver.getContexts()).find((c) => String(c).startsWith("WEBVIEW"));
      if (!web) return false;
      await driver.switchContext(String(web));
      return driver.execute(() => document.readyState === "complete" && !!document.querySelector("#root *"));
    },
    { timeout: 40_000, interval: 500, timeoutMsg: "El WebView de la app no apareció" },
  );
}

/** Misma interfaz que uiPlaywright, sobre Appium (WebdriverIO) dentro del WebView. */
export function uiIos(driver, { teclado }) {
  const campo = (etiqueta) => driver.$(xCampo(etiqueta));
  const esperar = (condicion, mensaje) => driver.waitUntil(condicion, { ...espera, timeoutMsg: mensaje });
  return {
    abrir: (ruta) => driver.execute((r) => { window.location.hash = `#${r}`; }, ruta),
    async escribir(etiqueta, texto) {
      const el = await campo(etiqueta);
      await el.waitForDisplayed({ timeout: espera.timeout });
      await el.clearValue();
      for (const letra of texto) {
        await el.addValue(letra);
        if (teclado) await pausa(teclado);
      }
    },
    async pegar(etiqueta, texto) {
      const el = await campo(etiqueta);
      await el.waitForDisplayed({ timeout: espera.timeout });
      await el.setValue(texto);
    },
    async pulsar(nombre) {
      const boton = await driver.$(`//button[normalize-space(.)=${literal(nombre)}]`);
      await boton.waitForClickable({ timeout: espera.timeout });
      await boton.click();
    },
    pausar: pausa,
    esperarValor: (etiqueta, valor) =>
      esperar(async () => (await (await campo(etiqueta)).getValue()) === valor, `El campo "${etiqueta}" no vale "${valor}"`),
    esperarAtributo: (etiqueta, atributo, valor) =>
      esperar(async () => (await (await campo(etiqueta)).getAttribute(atributo)) === valor, `"${etiqueta}" no tiene ${atributo}=${valor}`),
    esperarVisible: async (etiqueta) => (await campo(etiqueta)).waitForDisplayed({ timeout: espera.timeout }),
    esperarAusente: (etiqueta) =>
      esperar(async () => (await driver.$$(xCampo(etiqueta))).length === 0, `El campo "${etiqueta}" existe`),
    esperarUrl: (patron) => esperar(async () => patron.test(await driver.getUrl()), `La URL no coincide con ${patron}`),
    esperarTexto: (texto) =>
      driver.$(`//*[contains(normalize-space(.), ${literal(texto)})]`).then((el) => el.waitForDisplayed({ timeout: espera.timeout })),
  };
}
