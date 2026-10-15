import { expect } from "@playwright/test";

/**
 * Acciones de interfaz sobre un `page` de Playwright (web y WebView de Android).
 * Los pasos solo conocen esta interfaz; iOS la implementa en ui-ios.js con Appium.
 */
export function uiPlaywright(page, { abrir, teclado }) {
  const campo = (etiqueta) => page.getByLabel(etiqueta, { exact: true });
  return {
    abrir,
    async escribir(etiqueta, texto) {
      await campo(etiqueta).fill("");
      await campo(etiqueta).pressSequentially(texto, { delay: teclado });
    },
    pegar: (etiqueta, texto) => campo(etiqueta).fill(texto),
    pulsar: (nombre) => page.getByRole("button", { name: nombre }).click(),
    pausar: (ms) => page.waitForTimeout(ms).catch(() => {}),
    esperarValor: (etiqueta, valor) => expect(campo(etiqueta)).toHaveValue(valor),
    esperarAtributo: (etiqueta, atributo, valor) => expect(campo(etiqueta)).toHaveAttribute(atributo, valor),
    esperarVisible: (etiqueta) => expect(campo(etiqueta)).toBeVisible(),
    esperarAusente: (etiqueta) => expect(campo(etiqueta)).toHaveCount(0),
    esperarUrl: (patron) => expect(page).toHaveURL(patron),
    esperarTexto: (texto) => expect(page.getByText(texto).first()).toBeVisible(),
  };
}
