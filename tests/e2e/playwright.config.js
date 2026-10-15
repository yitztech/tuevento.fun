import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import { baseURL, englishURL, local, slowMo, lento, android } from "./support/entorno.js";

const englishHost = new URL(englishURL).hostname;

// Vídeo: E2E_VIDEO=on (siempre) | off | retain-on-failure (por defecto).
const video = process.env.E2E_VIDEO || "retain-on-failure";

const testDir = defineBddConfig({
  features: "features/**/*.feature",
  steps: "steps/**/*.js",
  outputDir: ".features-gen",
});

export default defineConfig({
  testDir,
  outputDir: "results/artifacts",
  // A ritmo humano un escenario tarda mucho más que los 30 s por defecto.
  timeout: lento ? 180_000 : 30_000,
  expect: { timeout: lento ? 15_000 : 5_000 },
  fullyParallel: !android,
  forbidOnly: !!process.env.CI,
  // En el emulador, el primer arranque de la app puede fallar al cargar: un reintento lo cubre y
  // queda marcado como "inestable" en el resumen (no se oculta).
  retries: process.env.CI || android ? 1 : 0,
  workers: android ? 1 : process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "results/report", open: "never" }],
    ["json", { outputFile: "results/results.json" }],
  ],
  use: {
    baseURL,
    locale: "es-ES",
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    video,
    trace: "retain-on-failure",
    launchOptions: {
      slowMo,
      args: local ? [`--host-resolver-rules=MAP ${englishHost} 127.0.0.1`] : [],
    },
  },
  // Android: solo los escenarios @movil, de uno en uno y en el WebView de la app.
  projects: android
    ? [{ name: "android", grep: /@movil/, grepInvert: /@solo-web/ }]
    : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
