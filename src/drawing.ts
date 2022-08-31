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
