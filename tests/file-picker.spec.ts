import { test, expect } from "@playwright/test";
import {
  mockFileAccessApi,
  supportsFsAccessAPI,
} from "./utils/native-fs-access-api.js";

test("Can pick a file", async ({ page, browserName }, testInfo) => {
  testInfo.skip(
    !!process.env.CI,
    "We have not set up correct snapshots on CI yet."
  );

  testInfo.fixme(
    browserName === "webkit",
    "Webkit does not fire filechooser events consistently"
  );

  const respondWith = "tests/fixtures/picked-1.jpg";
  await page.goto("/");

  // If the native fs access API is supported, then we must mock it;
  // this seems counter-intuitive, but Playwright does not provide helpers for the native API, since it is not widely supported.
  // Meanwhile, the code has a fallback to using input[type=file] when the native fs API is not supported, which means we can use Playwright's FileChooser API in that case.
  // eslint-disable-next-line playwright/no-conditional-in-test -- Needed to set up the mocking
  if (await supportsFsAccessAPI(page)) {
    testInfo.slow(); // The buffer serialisation can take a while on CI
    // TODO: Do this as initScript, and provide a global handle instead
    await mockFileAccessApi(page, respondWith);
    await page.getByRole("button", { name: "Pick image(s)" }).click();
  } else {
    // This method of setting up filechooser is slightly nicer than page.on('filechooser),
    // because it works better with step-debugging. The page.on version times out in the poll.
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Pick image(s)" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(respondWith);
  }

  await expect
    .poll(
      async () => {
        // Pick a rectangle in the middle of the canvas; it should not be white (the default)
        // We don't have a UI-first way of testing when the canvas has painted, and retrying the screenshot (.toPass) kept creating new snapshots for some reason
        return await page.locator("canvas").evaluate((canvas, canary) => {
          if (!(canvas instanceof HTMLCanvasElement)) {
            return false;
          }

          const ctx = canvas.getContext("2d");

          const testRectangle = ctx?.getImageData(
            1000 - 10,
            1000 - 10,
            10,
            10
          ).data;

          if (!testRectangle) {
            return false;
          }

          let pixels: number[][] = [];
          for (let i = 0; i < testRectangle.length; i += 4) {
            const chunk = [...testRectangle.slice(i, i + 4)];
            pixels.push(chunk);
          }
          return pixels;
        });
      },
      { message: "Ensure pixels are painted on the canvas" }
    )
    // If any pixel is not the canary, then we have painted
    .not.toContainEqual([255, 255, 255, 255]);

  await expect(page.locator("canvas")).toHaveScreenshot({
    maxDiffPixelRatio: 0.01,
  });
});
