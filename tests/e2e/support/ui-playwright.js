import { expect } from "@playwright/test";

/**
 * Acciones de interfaz sobre un `page` de Playwright (web y WebView de Android).
 * Los pasos solo conocen esta interfaz; iOS la implementa en ui-ios.js con Appium.
 */
export function uiPlaywright(page, { abrir, teclado, android = false, sinRed }) {
  const campo = (etiqueta) => page.getByLabel(etiqueta, { exact: true });
  return {
    abrir,
    async escribir(etiqueta, texto) {
      await campo(etiqueta).fill("");
      // En el WebView de Android, Playwright pierde teclas al escribirlas una a una (acentos,
      // símbolos del teléfono): el texto entra de una vez como un único evento `input`. Así
      // los filtros de la app (onChange) se siguen probando; en web se escribe tecla a tecla.
      if (android) return campo(etiqueta).fill(texto);
      await campo(etiqueta).pressSequentially(texto, { delay: teclado });
    },
    pegar: (etiqueta, texto) => campo(etiqueta).fill(texto),
    /** Valor de un campo que no se escribe tecla a tecla (fecha y hora). */
    fijarValor: (etiqueta, valor) => campo(etiqueta).fill(valor),
    /** Sin red o con red (solo en las apps: modo avión en Android). */
    async sinRed(activar) {
      if (!sinRed) throw new Error("Sin red solo se simula en las apps (E2E_TARGET=android o ios)");
      await sinRed(activar);
    },
    /** Opción de un grupo de radios (tipo de cuenta). */
    elegirOpcion: (nombre) => page.getByRole("radio", { name: new RegExp(nombre) }).check(),
    esperarOpcionElegida: (nombre) => expect(page.getByRole("radio", { name: new RegExp(nombre) })).toBeChecked(),
    /** Enlace del menú principal: presente o ausente (en el móvil el menú es un cajón, siempre en la página). */
    esperarEnlaceMenu: (texto, hay) =>
      expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: new RegExp(`^${texto}`) })).toHaveCount(
        hay ? 1 : 0,
      ),
    /** Espera a que la copia local tenga a esa cuenta y una sincronización (build de pruebas de las apps). */
    esperarCopiaLocal: (email) => page.waitForFunction((e) => window.tueventoPruebasCopiaLista?.(e), email),
    /** Cierra y vuelve a abrir la app: la página se carga de nuevo con lo guardado en el teléfono. */
    async reabrir() {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
    },
    async pulsar(nombre) {
      // En Android, un campo que sigue enfocado mantiene abierto el teclado, que mueve el botón:
      // no llega a estar estable. Se quita el foco antes de pulsar, como haría una persona.
      if (android) await page.evaluate(() => document.activeElement?.blur());
      // En el WebView, el teclado y las animaciones mueven el botón mientras Playwright lo busca,
      // y el clic cae fuera. El evento `click` del propio botón envía el formulario igual.
      const boton = page.getByRole("button", { name: nombre, exact: true });
      if (android) return boton.dispatchEvent("click");
      return boton.click();
    },
    pausar: (ms) => page.waitForTimeout(ms).catch(() => {}),
    esperarValor: (etiqueta, valor) => expect(campo(etiqueta)).toHaveValue(valor),
    esperarAtributo: (etiqueta, atributo, valor) => expect(campo(etiqueta)).toHaveAttribute(atributo, valor),
    esperarVisible: (etiqueta) => expect(campo(etiqueta)).toBeVisible(),
    esperarAusente: (etiqueta) => expect(campo(etiqueta)).toHaveCount(0),
    esperarUrl: (patron) => expect(page).toHaveURL(patron),
    esperarTexto: (texto) => expect(page.getByText(texto).first()).toBeVisible(),
  };
}
