import { execFileSync } from "node:child_process";
import { remote } from "webdriverio";

export const bundleIos = "com.tueventofun.app.pruebas";
// Como en Android (playwright.config.js): sincronizar al volver la red tarda unos segundos
const espera = { timeout: 20_000, interval: 150 };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const literal = (s) => (s.includes('"') ? `concat("${s.split('"').join('", \'"\', "')}")` : `"${s}"`);
const xCampo = (etiqueta) => `//input[@id=//label[normalize-space(.)=${literal(etiqueta)}]/@for]`;

/**
 * Simulador de iOS arrancado: E2E_IOS_UDID, o el que se llame E2E_IOS_SIMULADOR (p. ej.
 * "iPad Pro 13-inch (M5)"), o el primer iPhone (o iPad) arrancado. Se prepara con scripts/mobile-test-ios.sh.
 */
export function simuladorArrancado() {
  if (process.env.E2E_IOS_UDID) return process.env.E2E_IOS_UDID;
  const lista = JSON.parse(execFileSync("xcrun", ["simctl", "list", "devices", "booted", "-j"]));
  const arrancados = Object.values(lista.devices).flat();
  const nombre = process.env.E2E_IOS_SIMULADOR;
  const elegido = nombre ? arrancados.find((d) => d.name === nombre) : arrancados.find((d) => d.name.startsWith("iPhone")) ?? arrancados.find((d) => d.name.startsWith("iPad"));
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
    /** Fecha y hora: el selector nativo de iOS no se escribe; se fija como lo haría React. */
    fijarValor: (etiqueta, valor) =>
      driver.execute(
        (texto, v) => {
          const label = [...document.querySelectorAll("label")].find((l) => l.textContent.trim() === texto);
          const input = label && document.getElementById(label.htmlFor);
          if (!input) throw new Error(`Sin campo ${texto}`);
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, v);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        },
        etiqueta,
        valor,
      ),
    /** El simulador no puede quitarse la red: interruptor del build de pruebas (VITE_TEST_BUILD). */
    sinRed: (activar) => driver.execute((v) => window.tueventoPruebasSinRed(v), activar),
    // El `execute` de XCUITest no espera promesas: cada sondeo lanza la comprobación y lee la anterior
    elegirOpcion: async (nombre) => {
      const opcion = await driver.$(`//label[contains(normalize-space(.), ${literal(nombre)})]`);
      await opcion.waitForClickable({ timeout: espera.timeout });
      await opcion.click();
    },
    esperarOpcionElegida: (nombre) =>
      esperar(
        () =>
          driver.execute(
            (n) => [...document.querySelectorAll("label")].some((l) => l.textContent.includes(n) && l.querySelector('input[type="radio"]')?.checked),
            nombre,
          ),
        `La opción "${nombre}" no está elegida`,
      ),
    esperarEnlaceMenu: (texto, hay) =>
      esperar(
        async () =>
          (await driver.$$(`//nav[@aria-label="Navegación principal"]//a[starts-with(normalize-space(.), ${literal(texto)})]`)).length === (hay ? 1 : 0),
        `El enlace "${texto}" ${hay ? "no está" : "sigue"} en el menú`,
      ),
    esperarCopiaLocal: (email) =>
      esperar(
        () =>
          driver.execute((e) => {
            window.tueventoPruebasCopiaLista(e).then((listo) => { window.__copiaLista = listo; }, () => {});
            return window.__copiaLista === true;
          }, email),
        "La copia local no terminó de guardarse",
      ),
    async reabrir() {
      await driver.execute(() => window.location.reload());
      await driver.waitUntil(() => driver.execute(() => document.readyState === "complete" && !!document.querySelector("#root *")), {
        timeout: 40_000,
        interval: 500,
        timeoutMsg: "La app no volvió a cargar",
      });
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
    // El elemento más interno que contiene el texto (sus padres también lo contienen)
    esperarTexto: (texto) =>
      driver
        .$(`(//*[contains(normalize-space(.), ${literal(texto)}) and not(*[contains(normalize-space(.), ${literal(texto)})])])[1]`)
        .then((el) => el.waitForDisplayed({ timeout: espera.timeout })),
  };
}
