import { test, expect } from "@playwright/test";

// TODO: Use an environment variable to fetch a preview branch
const DEPLOY_URL = "http://localhost:3000";

test("has title", async ({ page }) => {
  await page.goto(DEPLOY_URL);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Framed/);
});

test("Can pick a file", async ({ page, browserName }) => {
  // NOTE: Atm, the filechooser API only works with input[type=file], instead of the native FS access API
  // We use the native FS API as a progressive enhancement, falling back to input[type=file]
  // Thus, if running in the Firefox or Safari test runner, we have a way to to test this, but not if we are in Chrome
  test.fixme(
    browserName === "chromium",
    "We do not have a way to mock the native fs access API at the moment, so we cannot test on Chromium."
  );
  await page.goto(DEPLOY_URL);
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Pick image(s)" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles("tests/fixtures/picked-1.jpg");
});
