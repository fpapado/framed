import { test, expect } from "@playwright/test";
import {
  mockFileAccessApi,
  supportsFsAccessAPI,
} from "./utils/native-fs-access-api.js";

test("Can pick a file", async ({ page, browserName }, testInfo) => {
  testInfo.skip(true, "We have not set up correct snapshots yet.");

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
  } else {
    page.on("filechooser", async (fileChooser) => {
      await fileChooser.setFiles(respondWith);
    });
  }

  await page.getByRole("button", { name: "Pick image(s)" }).click();

  // Wait for the processing message to appear and disappear; this signals that the image has settled
  // FIXME: This test can be flaky.
  // The loading message appears for the first-pass resize, which is typically the most time-consuming.
  // The second resize/paint is resonably fast, so most of the time this test passes (we paint on the screen after the loading)
  // To fix this, we should either find another test method or, more accurately, keep the loading message until after the second pass
  await expect(page.getByText(/Loading.../)).toBeVisible();
  await expect(page.getByText(/Loading.../)).not.toBeVisible();
  await expect(page.locator("canvas")).toHaveScreenshot({
    maxDiffPixelRatio: 0.01,
  });
});
