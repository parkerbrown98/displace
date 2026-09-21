import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.WEB_PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm dev --port ${webPort}`,
    url: `http://localhost:${webPort}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});