/**
 * Utilities for communicating with the service worker
 */

import { Workbox } from "workbox-window";
import { z } from "zod";

/**
 * Reload when the specified Service Worker takes over the page
 * This is done after `skipWaiting` is called, either automatically or when the user presses the "Update now" button
 * @see https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68
 * @see https://developer.chrome.com/docs/workbox/migration/migrate-from-v5/#cleaner-offer-a-page-reload-for-users-recipe
 */
export function skipWaitingAndReloadWhenControlling(wb: Workbox) {
  wb.addEventListener("controlling", () => {
    window.location.reload();
  });

  wb.messageSkipWaiting();
}

const LoadImageAction = z.object({
  action: z.literal("load-image"),
  file: z.custom<File>((data) => data instanceof File),
});

/** Wait for a shared image */
export function getSharedImage(): Promise<File> {
  return new Promise((resolve) => {
    const onmessage = (event: MessageEvent) => {
      const action = LoadImageAction.safeParse(event.data);
      if (!action.success) {
        return;
      }
      resolve(action.data.file);
      navigator.serviceWorker.removeEventListener("message", onmessage);
    };

    navigator.serviceWorker.addEventListener("message", onmessage);

    // This message is picked up by the service worker - it's how it knows we're ready to receive
    // the file.
    navigator.serviceWorker.controller?.postMessage("share-ready");
  });
}
