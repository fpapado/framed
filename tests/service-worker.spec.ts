import { test, expect } from "@playwright/test";

/**
 * Tests regarding service worker installation, in particular that the service worker exists and is installable.
 *
 * @see https://jeffy.info/2022/08/25/testing-a-service-worker.html
 */
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
    const expectedSwUrl = new URL("/service-worker.js", baseURL);
    expect(swURL).toBe(expectedSwUrl.href);

    // Now the caches can be inspected
    // (but not fetch events; those need more setup, see https://jeffy.info/2022/08/25/testing-a-service-worker.html)
    const cacheContents = await page.evaluate(async () => {
      const cacheState = {};
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        const reqs = await cache.keys();
        // Use the req.url string value, not an unserializable Request.
        // sort() allows the array to be used for stable comparisons.
        cacheState[cacheName] = reqs.map((req) => req.url).sort();
      }
      return cacheState;
    });

    // cacheContents now contains a mapping of cache names to a
    // sorted array of URL strings contained in the cache.
    const expectedPrecacheKey = `workbox-precache-v2-${baseURL}`;
    expect(Object.keys(cacheContents)).toContainEqual(expectedPrecacheKey);
    expect(cacheContents[expectedPrecacheKey]?.length).toBeGreaterThan(0);
  });
});
