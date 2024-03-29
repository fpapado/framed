import { type Color, parseColor } from "@react-stately/color";
import { atom, computed, react } from "signia";
import {
  type AspectRatio,
  type AspectRatioId,
  drawDiptychWithBackground,
  drawImageWithBackground,
  type Split,
} from "./drawing";
import { resizeToBlob, resizeToCanvas } from "./imageResize";

let isRafScheduled = false;
const scheduledEffects: Array<() => void> = [];
const scheduleEffect = (runEffect: () => void) => {
  scheduledEffects.push(runEffect);
  if (!isRafScheduled) {
    isRafScheduled = true;
    requestAnimationFrame(() => {
      isRafScheduled = false;
      scheduledEffects.forEach((runEffect) => runEffect());
      scheduledEffects.length = 0;
    });
  }
};

export const OPTIONS = {
  /** Border in pixels */
  border: 64,
  aspectRatio: "4x5" as AspectRatioId,
};

export const ASPECT_RATIOS: Record<AspectRatioId, AspectRatio> = {
  "1x1": {
    label: "Square",
    id: "1x1",
    width: 2000,
    height: 2000,
  },
  "4x5": {
    label: "4x5",
    id: "4x5",
    width: 1600,
    height: 2000,
  },
  "9x16": {
    label: "9x16",
    id: "9x16",
    width: 1080,
    height: 1920,
  },
};

export type ProcessingState = "inert" | "processing" | "error";

export const splitTypes: { value: Split; label: string }[] = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

export const initialBorder = OPTIONS.border;
export const initialAspectRatio = ASPECT_RATIOS[OPTIONS.aspectRatio];
export const initialBgColor = parseColor("hsb(0, 0%, 100%)");

export type CanvasState = {
  bgColor: Color;
  aspectRatio: AspectRatio;
  splitType: Split;
  border: number;
  blob: Blob | null;
  blob2: Blob | null;
};

export class Canvas {
  private readonly _state = atom<CanvasState>("Canvas._state", {
    aspectRatio: initialAspectRatio,
    splitType: "horizontal",
    bgColor: initialBgColor,
    border: initialBorder,
    blob: null,
    blob2: null,
  });

  get state() {
    return this._state.value;
  }

  @computed get bgColor() {
    return this.state.bgColor;
  }

  @computed get colorHex() {
    return this.bgColor.toString("hex");
  }

  @computed get aspectRatio() {
    return this.state.aspectRatio;
  }

  @computed get splitType() {
    return this.state.splitType;
  }

  @computed get border() {
    return this.state.border;
  }

  @computed private get blob() {
    return this.state.blob;
  }

  @computed private get blob2() {
    return this.state.blob2;
  }

  setBorder(border: number) {
    this._state.update((state) => ({
      ...state,
      border,
    }));
  }

  setBgColor(bgColor: Color) {
    this._state.update((state) => ({
      ...state,
      bgColor,
    }));
  }

  setAspectRatio(aspectRatio: AspectRatio) {
    this._state.update((state) => ({
      ...state,
      aspectRatio,
    }));
  }

  setSplitType(splitType: Split) {
    this._state.update((state) => ({
      ...state,
      splitType,
    }));
  }

  // When the user selects files, we:
  //   1) Run a first-pass downsizing (if needed) to a 2000 pixel fit.
  //      This is more than adequate for our aspect ratios, and ensures faster switching betwen aspect ratios (which resize to fit the box)
  //   2) Store those first-pass results to to the Canvas state, for future resizing (e.g. changing aspect ratio)
  async setBlobs(blob1: Blob, blob2?: Blob) {
    const [resized1, resized2] = (await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filter(Boolean) handles filtering
      [blob1, blob2].filter(Boolean).map((blob) => firstPassResize(blob!))
    )) as [Blob, Blob?];

    this._state.update((state) => ({
      ...state,
      blob: resized1,
      // If a second image exists, set it as well
      // Otherwise, reset to null, in case the user wants to override a diptych with a single image.
      blob2: resized2 ?? null,
    }));
  }

  // TODO: This async computed feels a bit gross, but it seems to work ok? The only thing missing is tracking of the processing state
  @computed
  private get resizedCanvases(): Promise<
    [HTMLCanvasElement, HTMLCanvasElement?] | undefined
  > {
    return (async () => {
      try {
        // NOTE: We use these directly instead of destructuring from state, to ensure we do not re-compute on unrelated changes
        const blob = this.blob;
        const blob2 = this.blob2;

        if (!blob && !blob2) {
          return;
        }

        const isDiptych = blob && blob2;

        // Resize images, if new ones are specified (e.g. picked new image, or aspect ratio changed)
        const [resizedCanvas1, resizedCanvas2] = await Promise.all(
          [blob, blob2].filter(Boolean).map((blob) =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- At least one blob is present, so the blob here is defined too
            resizeToCanvas(blob!, {
              maxWidth: isDiptych
                ? this.splitType === "horizontal"
                  ? (this.aspectRatio.width - this.border) / 2
                  : this.aspectRatio.width - this.border
                : this.aspectRatio.width - this.border * 2,
              maxHeight: isDiptych
                ? this.splitType === "horizontal"
                  ? this.aspectRatio.height - this.border
                  : (this.aspectRatio.height - this.border) / 2
                : this.aspectRatio.height - this.border / 2,
              allowUpscale: true,
            })
          )
        );

        return [resizedCanvas1, resizedCanvas2];
      } catch (err) {
        console.error(
          new Error("Unaccounted error when resizing", { cause: err })
        );
        return;
      }
    })();
  }

  drawOnCanvas(canvasDest: HTMLCanvasElement) {
    return react(
      "drawOnCanvas",
      async () => {
        // NOTE: We must destructure these before the await point, to ensure that the dependency is tracked correctly
        const colorHex = this.colorHex;
        const border = this.border;
        const aspectRatio = this.aspectRatio;
        const splitType = this.splitType;
        const canvases = await this.resizedCanvases;

        if (!canvases) {
          // Without images, just draw the bgColor
          drawImageWithBackground({
            canvasSrc: null,
            canvasDest: canvasDest,
            aspectRatio: aspectRatio,
            bgColor: colorHex,
          });
          return;
        }

        const [resizedCanvas1, resizedCanvas2] = canvases;
        const isDiptych = !!resizedCanvas2;

        // Re-draw the image(s)
        // TODO: We could change drawDiptych to a singular drawImages, which would make the choice based on how many images are provided
        // This would allow us to skip the isDiptych branch here, at the cost of adding branching to the inner logic
        if (isDiptych) {
          drawDiptychWithBackground({
            canvasSrc1: resizedCanvas1,
            canvasSrc2: resizedCanvas2,
            canvasDest: canvasDest,
            gap: border,
            aspectRatio: aspectRatio,
            bgColor: colorHex,
            split: splitType,
          });
        } else {
          // Not a diptych; draw whichever blob is defined, or just the background
          drawImageWithBackground({
            canvasSrc: resizedCanvas1,
            canvasDest: canvasDest,
            aspectRatio: aspectRatio,
            bgColor: colorHex,
          });
        }
      },
      // Batch based on animation frames, since this effect can fire multiple times (e.g. when changing colours quickly)
      { scheduleEffect }
    );
  }
}

const firstPassResize = (blob: Blob) =>
  resizeToBlob(blob, {
    maxWidth: 2000,
    maxHeight: 2000,
    allowUpscale: true,
  });
