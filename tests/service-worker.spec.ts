import { test, expect } from "@playwright/test";
import {
  HEX_CHARACTER_CLASS,
  createRegExp,
  removeHash,
} from "remove-filename-hash";

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
      const cacheState: Record<string, Array<string>> = {};
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
    // We should remove the hashed keys to be able to make stable assertions
    // @see https://github.com/jeffposnick/yt-playlist-notifier/blob/396624c7f3471ad2bf713b87579be60572ba0c64/tests/sw.spec.ts
    for (const [cacheName, urls] of Object.entries(cacheContents)) {
      cacheContents[cacheName] = urls
        .map((url) =>
          removeHash({
            stringWithHash: url,
            replacement: "[hash]",
            regexps: [
              // Static assets hashed by vite
              // e.g. http://localhost:4173/index-721b518b.js
              createRegExp({
                characters: HEX_CHARACTER_CLASS,
                size: 8,
                before: "-",
                after: ".",
              }),
              // Hashed by workbox-build
              // e.g. http://localhost:4173/manifest.webmanifest?__WB_REVISION__=[hash of 32 chars]
              createRegExp({
                characters: HEX_CHARACTER_CLASS,
                size: 32,
                before: "__WB_REVISION__=",
                after: "",
              }),
            ],
          })
        )
        .sort();
    }

    // FIXME: This can fail if we ever split the files differently (or if vite/Rollup splits them in some other way)
    // Should we do an "at least these ones" kind of match?
    const expected = {
      [`workbox-precache-v2-${baseURL}`]: [
        "/assets/CustomColorPicker-[hash].css",
        "/assets/CustomColorPicker-[hash].js",
        "/assets/framerFeatures-[hash].js",
        "/assets/index-[hash].css",
        "/assets/index-[hash].js",
        "/assets/noto-sans-v27-latin-600-[hash].woff2",
        "/assets/noto-sans-v27-latin-regular-[hash].woff2",
        "/index.html?__WB_REVISION__=[hash]",
        "/manifest.webmanifest?__WB_REVISION__=[hash]",
      ].map((path) => new URL(path, baseURL).href),
    };

    expect(cacheContents).toEqual(expected);
  });
});
