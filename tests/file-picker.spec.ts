import { test, expect } from "@playwright/test";
import {
  mockFileAccessApi,
  supportsFsAccessAPI,
} from "./utils/native-fs-access-api";

// TODO: Use an environment variable to fetch a preview branch
const DEPLOY_URL = "http://localhost:3000";

test("Can pick a file", async ({ page, browserName }, testInfo) => {
  testInfo.fixme(
    browserName === "webkit",
    "Webkit does not fire filechooser events consistently"
  );

  const respondWith = "tests/fixtures/picked-1.jpg";
  await page.goto(DEPLOY_URL);

  // If the native fs access API is supported, then we must mock it;
  // this seems counter-intuitive, but Playwright does not provide helpers for the native API, since it is not widely supported.
  // Meanwhile, the code has a fallback to using input[type=file] when the native fs API is not supported, which means we can use Playwright's FileChooser API in that case.
  if (await supportsFsAccessAPI(page)) {
    testInfo.slow(); // The buffer serialisation takes a while on CI
    await mockFileAccessApi(page, respondWith);
  } else {
    page.on("filechooser", async (fileChooser) => {
      await fileChooser.setFiles(respondWith);
    });
  }

  await page.getByRole("button", { name: "Pick image(s)" }).click();

  // Wait for the processing message to appear and disappear; this signals that the image has settled
  await expect(page.getByText(/Loading.../)).toBeVisible();
  await expect(page.getByText(/Loading.../)).not.toBeVisible();
  await expect(page.locator("canvas")).toHaveScreenshot();
});
