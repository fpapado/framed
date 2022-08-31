import { AspectRatio } from "./App";

/**
 * Draw an image with a specified background onto a canvas, fitting to the middle
 * @param canvasDest
 */
export function drawImageWithBackground({
  canvasDest,
  canvasSrc,
  aspectRatio,
  border = 0,
  bgColor,
}: {
  canvasSrc?: HTMLCanvasElement | null;
  canvasDest: HTMLCanvasElement | null;
  aspectRatio: AspectRatio;
  border?: number;
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
    const orientation =
      canvasSrc.width > canvasSrc.height
        ? "landscape"
        : canvasSrc.width < canvasSrc.height
        ? "portrait"
        : "square";

    let dx = 0;
    let dy = 0;

    if (orientation === "landscape") {
      dx = 0 + border;
      dy = (aspectRatio.height - canvasSrc.height) / 2;
    } else if (orientation === "portrait") {
      dx = (aspectRatio.width - canvasSrc.width) / 2;
      dy = 0 + border;
    } else {
      dx = (aspectRatio.width - canvasSrc.width) / 2;
      dy = (aspectRatio.height - canvasSrc.height) / 2;
    }

    canvasDestCtx.drawImage(canvasSrc, dx, dy);
  }
}
