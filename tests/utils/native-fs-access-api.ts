import { type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

export async function supportsFsAccessAPI(page: Page) {
  return page.evaluate(() => "showOpenFilePicker" in window);
}

export async function mockFileAccessApi(page: Page, respondWith: string) {
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
