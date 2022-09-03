/**
 * Utilities for communicating with the service worker
 */

/**
 * Reload once when the new Service Worker starts activating
 * This is done after `skipWaiting` is called, either automatically or when the user presses the "Update now" button
 * @see https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68
 */
export function setupRefreshOnControllerChange() {
  let refreshing: boolean;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

/** Wait for a shared image */
export function getSharedImage(): Promise<File> {
  return new Promise((resolve) => {
    const onmessage = (event: MessageEvent) => {
      if (event.data.action !== "load-image") return;
      resolve(event.data.file);
      navigator.serviceWorker.removeEventListener("message", onmessage);
    };

    navigator.serviceWorker.addEventListener("message", onmessage);

    // This message is picked up by the service worker - it's how it knows we're ready to receive
    // the file.
    navigator.serviceWorker.controller?.postMessage("share-ready");
  });
}
