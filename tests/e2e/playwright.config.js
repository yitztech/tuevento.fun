import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { defineBddConfig } from "playwright-bdd";
import { baseURL, englishURL, local, slowMo, lento, android, ios } from "./support/entorno.js";

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
  fullyParallel: !(android || ios),
  forbidOnly: !!process.env.CI,
  // En el emulador, el primer arranque de la app puede fallar al cargar: un reintento lo cubre y
  // queda marcado como "inestable" en el resumen (no se oculta).
  retries: process.env.CI || android || ios ? 1 : 0,
  workers: android || ios ? 1 : process.env.CI ? 2 : undefined,
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
    : ios
      ? [{ name: "ios", grep: /@movil/, grepInvert: /@solo-web|@sin-ios/ }]
      : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // iOS: Appium es el servidor que habla con el simulador; Playwright lo arranca y lo para.
  webServer: ios
    ? {
        command: "npx appium --port 4723",
        url: "http://127.0.0.1:4723/status",
        reuseExistingServer: true,
        timeout: 60_000,
        env: { ...process.env, APPIUM_HOME: fileURLToPath(new URL("../mobile/.appium", import.meta.url)) },
      }
    : undefined,
});
