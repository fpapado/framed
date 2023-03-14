import { test, expect } from "@playwright/test";

test("Share button shows up, and has correct icon", async ({
  page,
  browserName,
}, testInfo) => {
  await page.goto("/");

  // NOTE: Feature check must come after navigating to a page, because share is only available in secure contexts
  const supportsShare = await page.evaluate(() => "share" in navigator);
  testInfo.skip(
    !supportsShare,
    `This browser does not support sharing. browserName: ${browserName}, platform: ${process.platform}`
  );

  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();

  // Exercise browser-style detection
  const expectedShareStyle =
    process.platform === "darwin" ? "apple" : "android";

  await expect
    .soft(page.getByTestId(`share-style-${expectedShareStyle}`))
    .toBeVisible();
});
