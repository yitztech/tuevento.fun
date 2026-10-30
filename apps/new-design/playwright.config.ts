import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5190", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "npm run build && npm run preview -- --port 5190",
    url: "http://127.0.0.1:5190",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
