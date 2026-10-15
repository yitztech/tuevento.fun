import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import { baseURL, englishURL, local, slowMo, lento } from "./support/entorno.js";

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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
