// @ts-ignore
import ImageBlobReduce from "image-blob-reduce";

const imageReducer = new ImageBlobReduce();

imageReducer._calculate_size = function (env: any) {
  // Override with a "fit maximally" function
  let scale_factor;

  // Android flips photos with EXIF, which can cause images to be rotated to the other orientation
  // This means that the math for portrait images is treated as landscape and vice-versa.
  // This causes the wrong fit, because orientation matters in how we fit!
  // @see https://sirv.com/help/articles/rotate-photos-to-be-upright/
  const isRotated90Deg = env.orientation === 5 || env.orientation === 6;
  const imageOrientation =
    env.image.width === env.image.height
      ? "square"
      : env.image.width > env.image.height
      ? "landscape"
      : "portrait";

  // Landscape image, or rotated portrait: scale to fit the width
  if (
    (imageOrientation === "landscape" && !isRotated90Deg) ||
    (imageOrientation === "portrait" && isRotated90Deg)
  ) {
    scale_factor =
      env.opts.maxWidth / Math.max(env.image.width, env.image.height);
  }
  // Portrait image, or rotated landscape: scale to fit the height
  else if (
    (imageOrientation === "portrait" && !isRotated90Deg) ||
    (imageOrientation === "landscape" && isRotated90Deg)
  ) {
    scale_factor =
      env.opts.maxHeight / Math.max(env.image.width, env.image.height);
  }
  // Square image: scale to fit the shortest dimension
  else {
    scale_factor =
      Math.min(env.opts.maxHeight, env.opts.maxWidth) /
      Math.max(env.image.width, env.image.height);
  }

  if (scale_factor > 1) {
    console.warn(
      "The image is smaller than the resize dimensions; will upscale."
    );
    // This was here originally, to prevent upscaling
    // scale_factor = 1;
  }

  env.transform_width = Math.max(Math.round(env.image.width * scale_factor), 1);
  env.transform_height = Math.max(
    Math.round(env.image.height * scale_factor),
    1
  );

  // Info for user plugins, to check if scaling applied
  env.scale_factor = scale_factor;

  return Promise.resolve(env);
};

type ResizeToCanvasOpts = {
  maxWidth: number;
  maxHeight: number;
  /** Signal associated with the operation, and whether it has been canceled. Use it to cancel the resizing task */
  signal?: AbortSignal;
};

export async function resizeToCanvas(
  blob: Blob,
  { maxWidth, maxHeight, signal }: ResizeToCanvasOpts
): Promise<HTMLCanvasElement> {
  return imageReducer.toCanvas(blob, {
    maxWidth,
    maxHeight,
    cancelToken: signal && createCancelationToken(signal),
  });
}

/**
 * Utility to create a cancelation token, which will reject if aborted, based on a signal.
 * This is backed by an AbortController/AbortSignal, which allows us to cancel the operations
 * without keeping a reference to them; we only need a reference to the controller.
 */
function createCancelationToken(signal: AbortSignal) {
  return new Promise((_resolve, reject) => {
    // It's possible the signal is already aborted!
    if (signal.aborted) {
      reject(signal.reason);
    }

    // Attach a listener to the 'abort' event, in case it gets aborted in the future
    signal.addEventListener("abort", () => {
      reject(signal.reason);
    });
  });
}
