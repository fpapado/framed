/**
 * Utilities for communicating with the service worker
 */

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
