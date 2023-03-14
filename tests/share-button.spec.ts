import { test, expect } from "@playwright/test";

test("Share button shows up", async ({ page, browserName }, testInfo) => {
  await page.goto("/");

  // NOTE: Feature check must come after navigating to a page, because share is only available in secure contexts
  const supportsShare = await page.evaluate(() => "share" in navigator);
  testInfo.skip(
    !supportsShare,
    `This browser does not support sharing. browserName: ${browserName}, platform: ${process.platform}`
  );

  const shareButton = page.getByRole("button", { name: "Share" });
  await expect(shareButton).toBeVisible();

  // Exercise browser-style detection
  const expectedShareStyleId = `share-style-${
    process.platform === "darwin" ? "apple" : "android"
  }`;

  await expect(page.getByTestId(expectedShareStyleId)).toBeVisible();
});
