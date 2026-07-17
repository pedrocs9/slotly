import { defineConfig, devices } from "@playwright/test"

process.env.RATE_LIMIT_LOGIN_LIMIT ??= "1000"
process.env.RATE_LIMIT_BOOKING_LIMIT ??= "1000"
process.env.RATE_LIMIT_PUBLIC_LIMIT ??= "1000"
process.env.RATE_LIMIT_PUBLIC_SLOTS_LIMIT ??= "1000"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm.cmd run dev -- -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile-375", use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true } },
    { name: "mobile-430", use: { browserName: "chromium", viewport: { width: 430, height: 932 }, isMobile: true } },
    { name: "tablet-768", use: { browserName: "chromium", viewport: { width: 768, height: 1024 } } },
    { name: "wide-1440", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
})
