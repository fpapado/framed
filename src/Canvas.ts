import { Color, parseColor } from "@react-stately/color";
import { atom, computed, react, whyAmIRunning } from "signia";
import {
  AspectRatio,
  AspectRatioId,
  drawDiptychWithBackground,
  drawImageWithBackground,
  Split,
} from "./drawing";
import { resizeToCanvas } from "./imageResize";

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

export const initialAspectRatio = ASPECT_RATIOS[OPTIONS.aspectRatio];
export const initialBgColor = parseColor("hsb(0, 0%, 100%)");

export type CanvasState = {
  bgColor: Color;
  aspectRatio: AspectRatio;
  splitType: Split;
  blob: Blob | null;
  blob2: Blob | null;
};

export class Canvas {
  private readonly _state = atom<CanvasState>("Canvas._state", {
    aspectRatio: initialAspectRatio,
    splitType: "horizontal",
    bgColor: initialBgColor,
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

  @computed private get blob() {
    return this.state.blob;
  }

  @computed private get blob2() {
    return this.state.blob2;
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

  setBlob(blob: Blob | null) {
    this._state.update((state) => ({
      ...state,
      blob,
    }));
  }

  setBlob2(blob2: Blob | null) {
    this._state.update((state) => ({
      ...state,
      blob2,
    }));
  }

  @computed
  private get resizedCanvases() {
    return (async () => {
      try {
        // NOTE: We use these directly instead of destructuring from state, to ensure we do not re-compute on unrelated changes
        const blob = this.blob;
        const blob2 = this.blob2;

        if (!blob && !blob2) {
          return;
        }

        // this.setProcessingState("processing");
        const isDiptych = blob && blob2;

        // Resize images, if new ones are specified (e.g. picked new image, or aspect ratio changed)
        const [resizedCanvas1, resizedCanvas2] = await Promise.all(
          [blob, blob2].filter(Boolean).map((blob) =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- At least one blob is present, so the blob here is defined too
            resizeToCanvas(blob!, {
              maxWidth: isDiptych
                ? this.splitType === "horizontal"
                  ? (this.aspectRatio.width - OPTIONS.border) / 2
                  : this.aspectRatio.width - OPTIONS.border
                : this.aspectRatio.width - OPTIONS.border * 2,
              maxHeight: isDiptych
                ? this.splitType === "horizontal"
                  ? this.aspectRatio.height - OPTIONS.border
                  : (this.aspectRatio.height - OPTIONS.border) / 2
                : this.aspectRatio.height - OPTIONS.border / 2,
              allowUpscale: true,
            })
          )
        );

        // this.setProcessingState("inert");
        return [resizedCanvas1, resizedCanvas2] as const;
      } catch (err) {
        // Ignore error if it is a cancelation error; this is expected
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error(
          new Error("Unaccounted error when resizing", { cause: err })
        );
        // this.setProcessingState("error");
      }
    })();
  }

  drawOnCanvas(canvasDest: HTMLCanvasElement) {
    // TODO: Some incremental approach to resizedCanvases
    return react(
      "drawOnCanvas",
      async () => {
        whyAmIRunning();
        // NOTE: We must destructure this before the await point, to ensure that the dependency is tracked correctly
        const colorHexValue = this.colorHex;
        const canvases = await this.resizedCanvases;

        if (!canvases) {
          // Without images, just draw the bgColor
          drawImageWithBackground({
            canvasSrc: null,
            canvasDest: canvasDest,
            aspectRatio: this.aspectRatio,
            bgColor: colorHexValue,
          });
          return;
        }

        const [resizedCanvas1, resizedCanvas2] = canvases;
        const isDiptych = resizedCanvas1 && resizedCanvas2;

        // Re-draw the image(s)
        // TODO: We could change drawDiptych to a singular drawImages, which would make the choice based on how many images are provided
        // This would allow us to skip the isDiptych branch here, at the cost of adding branching to the inner logic
        if (isDiptych) {
          drawDiptychWithBackground({
            canvasSrc1: resizedCanvas1,
            canvasSrc2: resizedCanvas2,
            canvasDest: canvasDest,
            gap: OPTIONS.border,
            aspectRatio: this.aspectRatio,
            bgColor: colorHexValue,
            split: this.splitType,
          });
        } else {
          // Not a diptych; draw whichever blob is defined, or just the background
          drawImageWithBackground({
            canvasSrc: resizedCanvas1 ?? resizedCanvas2,
            canvasDest: canvasDest,
            aspectRatio: this.aspectRatio,
            bgColor: colorHexValue,
          });
        }
      },
      // Batch based on animation frames, since this effect can fire multiple times (e.g. when changing colours quickly)
      { scheduleEffect }
    );
  }
}
