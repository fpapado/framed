import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

const DEV_SERVER_PORT = 5173;

/**
 * Playwright configuration for local tests, using the development build
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  grepInvert: /@prodOnly/,
  testDir: "./tests",
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm run start",
    port: DEV_SERVER_PORT,
    reuseExistingServer: !process.env.CI,
  },

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,

    /** baseUrl used for all tests, so that page.goto('/') gets prefixed correctly */
    baseURL: `http://localhost:${DEV_SERVER_PORT}/`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    // To consider later:
    // {
    // edge supports sharing on macOS
    //   name: "edge",
    //   use: { ...devices["Desktop Edge"], channel: "msedge" },
    // },
    // {
    // mobile chrome is good to include both for sharing and file picking
    // also, the app is largely used on mobile
    //   name: "mobile-chrome",
    //   use: { ...devices["Pixel 5"] },
    // },
    // {
    // mobile safari is good to include both for sharing and file picking
    // also, the app is largely used on mobile
    //   name: "mobile-safari",
    //   use: { ...devices["iPhone 13"] },
    // },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  // outputDir: 'test-results/',
});
