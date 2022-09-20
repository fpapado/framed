export type AspectRatioId = "1x1" | "4x5" | "9x16";

export type AspectRatio = {
  id: AspectRatioId;
  label: string;
  width: number;
  height: number;
};

/**
 * Draw an image with a specified background onto a canvas, fitting to the middle
 * @param canvasDest
 */
export function drawImageWithBackground({
  canvasDest,
  canvasSrc,
  aspectRatio,
  bgColor,
}: {
  canvasSrc?: HTMLCanvasElement | null;
  canvasDest: HTMLCanvasElement | null;
  aspectRatio: AspectRatio;
  bgColor: string;
}) {
  const canvasDestCtx = canvasDest?.getContext("2d");

  if (!canvasDest || !canvasDestCtx) {
    console.error("No destination canvas found!");
    return;
  }

  // Set width/height
  canvasDest.width = aspectRatio.width;
  canvasDest.height = aspectRatio.height;

  // First, draw background
  canvasDestCtx.fillStyle = bgColor;
  canvasDestCtx.fillRect(0, 0, aspectRatio.width, aspectRatio.height);

  // Then, draw scaled image, if specified
  if (canvasSrc) {
    let dx = (aspectRatio.width - canvasSrc.width) / 2;
    let dy = (aspectRatio.height - canvasSrc.height) / 2;

    if (process.env.NODE_ENV !== "production") {
      console.table({
        dx,
        dy,
        srcWidth: canvasSrc.width,
        srcHeight: canvasSrc.height,
        width: aspectRatio.width,
        height: aspectRatio.height,
      });
    }

    canvasDestCtx.drawImage(canvasSrc, dx, dy);
  }
}

export type Split = "horizontal" | "vertical";

/**
 * Draw two images with a specified background onto a canvas, fitting to the middle
 * @todo add `gap` property
 * @param canvasDest
 */
export function drawDiptychWithBackground({
  canvasDest,
  canvasSrc1,
  canvasSrc2,
  aspectRatio,
  gap,
  bgColor,
  split,
}: {
  canvasSrc1?: HTMLCanvasElement | null;
  canvasSrc2?: HTMLCanvasElement | null;
  canvasDest: HTMLCanvasElement | null;
  gap: number;
  aspectRatio: AspectRatio;
  bgColor: string;
  split: Split;
}) {
  const canvasDestCtx = canvasDest?.getContext("2d");

  if (!canvasDest || !canvasDestCtx) {
    console.error("No destination canvas found!");
    return;
  }

  // Set width/height
  canvasDest.width = aspectRatio.width;
  canvasDest.height = aspectRatio.height;

  // First, draw background
  canvasDestCtx.fillStyle = bgColor;
  canvasDestCtx.fillRect(0, 0, aspectRatio.width, aspectRatio.height);

  // Then, draw scaled image, if specified
  if (canvasSrc1) {
    let dx: number, dy: number;

    if (split === "horizontal") {
      // Justify center, minus gap
      dx = aspectRatio.width / 2 - canvasSrc1.width - gap * (3 / 16);
      // Align center
      dy = (aspectRatio.height - canvasSrc1.height) / 2;
    } else {
      // Align center
      dx = (aspectRatio.width - canvasSrc1.width) / 2;
      // Justify center, minus gap
      dy = aspectRatio.height / 2 - canvasSrc1.height - gap * (3 / 16);
    }

    if (process.env.NODE_ENV !== "production") {
      console.table({
        dx,
        dy,
        srcWidth: canvasSrc1.width,
        srcHeight: canvasSrc1.height,
        width: aspectRatio.width,
        height: aspectRatio.height,
      });
    }

    canvasDestCtx.drawImage(canvasSrc1, dx, dy);
  }

  if (canvasSrc2) {
    let dx: number, dy: number;

    if (split === "horizontal") {
      // Justify center, plus gap
      dx = aspectRatio.width / 2 + gap * (3 / 16);
      // Align center
      dy = (aspectRatio.height - canvasSrc2.height) / 2;
    } else {
      // Align center
      dx = (aspectRatio.width - canvasSrc2.width) / 2;
      // Justify center, plus gap
      dy = aspectRatio.height / 2 + gap * (3 / 16);
    }

    if (process.env.NODE_ENV !== "production") {
      console.table({
        dx,
        dy,
        srcWidth: canvasSrc2.width,
        srcHeight: canvasSrc2.height,
        width: aspectRatio.width,
        height: aspectRatio.height,
      });
    }

    canvasDestCtx.drawImage(canvasSrc2, dx, dy);
  }
}
