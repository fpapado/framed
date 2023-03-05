import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

// TODO: Use an environment variable to fetch a preview branch
const DEPLOY_URL = "http://localhost:3000";

async function supportsFsAccessAPI(page: Page) {
  return page.evaluate(() => "showOpenFilePicker" in window);
}

async function mockFileAccessApi(page: Page, respondWith: string) {
  const name = path.basename(respondWith);
  const mimeType = "image/jpeg";

  // Read file and convert to a serialisable array, because that is required for passing into evaluate arguments
  const buffer = (
    await fs.readFile(path.relative(process.cwd(), respondWith))
  ).toJSON().data;

  await page.evaluate(
    ({ name, buffer, mimeType }) => {
      class FileSystemFileHandleMock {
        private file: File;

        constructor(file: File) {
          this.file = file;
        }

        async getFile() {
          console.log("getFile", this.file);
          return this.file;
        }
      }

      (window as any).showOpenFilePicker = async ({
        id,
        startIn,
        types,
        multiple,
        excludeAcceptAllOptions,
      }) => {
        return [
          new FileSystemFileHandleMock(
            new File([new Blob([new Uint8Array(buffer)])], name, {
              type: mimeType,
            })
          ),
        ];
      };
    },
    { name, buffer, mimeType }
  );
}

test("has title", async ({ page }) => {
  await page.goto(DEPLOY_URL);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Framed/);
});

test("Can pick a file", async ({ page }, testInfo) => {
  const respondWith = "tests/fixtures/picked-1.jpg";
  await page.goto(DEPLOY_URL);

  // If the native fs access API is supported, then we must mock it;
  // this seems counter-intuitive, but Playwright does not provide helpers for the native API, since it is not widely supported.
  // Meanwhile, the code has a fallback to using input[type=file] when the native fs API is not supported, which means we can use Playwright's FileChooser API in that case.
  if (await supportsFsAccessAPI(page)) {
    console.log("Supports fs access API, falling back");
    await mockFileAccessApi(page, respondWith);
    await page.getByRole("button", { name: "Pick image(s)" }).click();
  } else {
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Pick image(s)" }).click();
    await page.getByRole("button", { name: "Pick image(s)" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(respondWith);
  }

  await expect(page.getByText(/Loading.../)).toBeVisible();
  await expect(page.getByText(/Loading.../)).not.toBeVisible();

  // const hasBlob = await page.locator("canvas").evaluate(async (canvas) => {
  //   if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
  //     throw new Error("canvas locator must be a valid canvas element");
  //   }
  //   return new Promise<boolean>((res, rej) => {
  //     canvas.toBlob((blob) => {
  //       if (!blob) {
  //         rej("No image data in canvas");
  //       } else {
  //         res(true);
  //       }
  //     });
  //   });
  // });
  // expect(hasBlob).toBeTruthy();
  await expect(page.locator("canvas")).toHaveScreenshot();
});
