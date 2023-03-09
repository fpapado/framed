import devConfig from "./playwright.config.js";
import { defineConfig } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

const PREVIEW_SERVER_PORT = 4173;

/**
 * Playwright configuration for local tests, using the production build.
 * Useful to test service workers, which only get emitted on production.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...devConfig,
  grepInvert: undefined,
  // The config is the same, except we run `preview` and serve it under port 5173
  use: { ...devConfig.use, baseURL: `http://localhost:${PREVIEW_SERVER_PORT}` },
  webServer: {
    ...devConfig.webServer,
    command: "pnpm run preview",
    port: PREVIEW_SERVER_PORT,
  },
});
