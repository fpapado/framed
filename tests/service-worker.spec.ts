import { test, expect } from "@playwright/test";

test.describe("@prodOnly service worker tests", () => {
  test("post-install state", async ({ baseURL, page }) => {
    // Navigate to a page which registers a service worker.
    await page.goto("/");

    // wait for the service worker to be installed
    const swURL = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.scriptURL;
    });

    // Confirm that the expected service worker script installed.
    expect(swURL).toBe(`${baseURL}/service-worker.js`);

    // Now you're ready to check cache or IndexedDB state.
  });
});
