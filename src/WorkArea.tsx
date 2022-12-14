import { Color, parseColor } from "@react-stately/color";
import { FileWithHandle, fileSave } from "browser-fs-access";
import React, {
  useRef,
  useState,
  useId,
  useCallback,
  useEffect,
  useMemo,
  Suspense,
  lazy,
  PropsWithChildren,
} from "react";
import { m } from "framer-motion";
import { ErrorBoundary } from "react-error-boundary";

import {
  AspectRatio,
  AspectRatioId,
  drawDiptychWithBackground,
  drawImageWithBackground,
  Split,
} from "./drawing";
import { FilePicker } from "./FilePicker";
import { AndroidStyleShareIcon } from "./icons/AndroidStyleShareIcon";
import { AppleStyleShareIcon } from "./icons/AppleStyleShareIcon";
import { ArrowDown } from "./icons/ArrowDown";
import { resizeToBlob, resizeToCanvas } from "./imageResize";
import { getSharedImage } from "./serviceWorker/swBridge";
import { getCanaryEmptyShareFile } from "./utils/canaryShareFile";

const LazyCustomColorPicker = lazy(() =>
  import("./CustomColorPicker").then((m) => ({ default: m.CustomColorPicker }))
);

export const SUPPORTS_SHARE = Boolean(navigator.share);

const OPTIONS = {
  /** Border in pixels */
  border: 64,
  aspectRatio: "4x5" as AspectRatioId,
};

const ASPECT_RATIOS: Record<AspectRatioId, AspectRatio> = {
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

type ProcessingState = "inert" | "processing" | "error";

type SharingState = "inert" | "sharing" | "error" | "success";

const initialAspectRatio = ASPECT_RATIOS[OPTIONS.aspectRatio];
const initialSplitType: Split = "horizontal";
const initialBgColor = parseColor("hsb(0, 0%, 100%)");

const splitTypes: { value: Split; label: string }[] = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

export function WorkArea() {
  // Image canvas, containting data after transforming / scaling, but not the one that we paint on screen
  // Used to share the image between paint methods
  const canvasSrcRef = useRef<HTMLCanvasElement>();
  const canvasSrc2Ref = useRef<HTMLCanvasElement>();

  // Keep a controller to cancel processing, e.g. when the user changes a setting
  const processingAbortController = useRef<AbortController>();

  // A reference to the file the user picked; picking a file does not cause rendering by itself, but actions that change it
  // will typically also redraw on the canvas
  const originalFileRef = useRef<Blob>();
  const originalFile2Ref = useRef<Blob>();

  // Destination canvas; the one that we manipulate on-screen
  const canvasDestRef = useRef<HTMLCanvasElement>(null);

  // State/options based on user selections
  const [bgColor, setBgColor] = useState(initialBgColor);

  const bgColorHex = useMemo(() => bgColor.toString("hex"), [bgColor]);

  // TODO: This could be a ref, since it doesn't affect rendering per se
  const [filenames, setFilenames] = useState<string[]>();
  const [aspectRatio, setAspectRatio] =
    useState<AspectRatio>(initialAspectRatio);
  const [splitType, setSplitType] = useState<Split>(initialSplitType);

  // Ids and stuff
  const id = useId();
  const ID = {
    bgColorInput: `${id}-bgColor`,
    aspectRatioInput: `${id}-aspectRatio`,
    splitTypeInput: `${id}-aspectRatio`,
    filePickerDescription: `${id}-filePickerDescription`,
  };

  // Processing state for async operations
  const [processingState, setProcessingState] =
    useState<ProcessingState>("inert");

  const updateCanvas = useCallback(
    async ({
      blob,
      blob2,
      aspectRatio,
      bgColor,
      splitType,
    }: {
      blob?: Blob;
      blob2?: Blob;
      aspectRatio: AspectRatio;
      bgColor: Color;
      splitType: Split;
    }) => {
      try {
        setProcessingState("processing");

        // We are rendering a diptych if either:
        // Both new images provided (e.g. picking two new images)
        const bothNew = blob && blob2;

        // Both old images (e.g. updating background color)
        const bothOld = canvasSrcRef.current && canvasSrc2Ref.current;

        // An update happens when a single blob changes, while a previous second src ref is present
        // This happens when picking only one new image, in which case we must change from a diptych to a single
        const isSingleImageUpdate = (blob && !blob2) || (blob2 && !blob);

        const isDiptych = !isSingleImageUpdate && (bothNew || bothOld);

        // Resize images, if new ones are specified (e.g. picked new image, or aspect ratio changed)
        // Cancel existing tasks and start a new one
        processingAbortController.current?.abort();
        processingAbortController.current = new AbortController();

        const [resizedCanvas1, resizedCanvas2] = await Promise.all(
          [blob, blob2].filter(Boolean).map((blob) =>
            resizeToCanvas(blob!, {
              maxWidth: isDiptych
                ? splitType === "horizontal"
                  ? (aspectRatio.width - OPTIONS.border) / 2
                  : aspectRatio.width - OPTIONS.border
                : aspectRatio.width - OPTIONS.border * 2,
              maxHeight: isDiptych
                ? splitType === "horizontal"
                  ? aspectRatio.height - OPTIONS.border
                  : (aspectRatio.height - OPTIONS.border) / 2
                : aspectRatio.height - OPTIONS.border / 2,
              allowUpscale: true,
              signal: processingAbortController.current!.signal,
            })
          )
        );

        // Reset the abort controller, because it is no longer relevant
        processingAbortController.current = undefined;

        // Update the stored canvas refs for future operations (e.g. re-drawing after changing colour)
        // NOTE: Some operations do not specify a blob, e.g. those that just re-draw to change a colour
        // Thus, it is important to not reset the src refs if resized canvases are blank (because the colour updates don't resize)
        if (resizedCanvas1) {
          canvasSrcRef.current = resizedCanvas1;
        }
        if (resizedCanvas2) {
          canvasSrc2Ref.current = resizedCanvas2;
        }

        // Re-draw the image(s)
        // TODO: We could change drawDiptych to a singular drawImages, which would make the choice based on how many images are provided
        // This would allow us to skip the isDiptych branch here, at the cost of adding branching to the inner logic
        if (isDiptych) {
          drawDiptychWithBackground({
            canvasSrc1: canvasSrcRef.current,
            canvasSrc2: canvasSrc2Ref.current,
            canvasDest: canvasDestRef.current,
            gap: OPTIONS.border,
            aspectRatio,
            bgColor: bgColor.toString("hex"),
            split: splitType,
          });
        } else {
          // Not a diptych; draw whichever blob is defined, or just the background
          drawImageWithBackground({
            canvasSrc: canvasSrcRef.current ?? canvasSrc2Ref.current,
            canvasDest: canvasDestRef.current,
            aspectRatio,
            bgColor: bgColor.toString("hex"),
          });
        }

        setProcessingState("inert");
      } catch (err) {
        // Ignore error if it is a cancelation error; this is expected
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Unaccounted error: ", err);
        setProcessingState("error");
      }
    },
    []
  );

  /** Effect to listen for the share target and receive an image file
   * TODO: Support two/multiple shared images in the target
   */
  useEffect(() => {
    /* Flag to cancel the effect if it is no longer relevant (i.e. if cleanup was invoked) */
    let hasCleanedUp = false;
    const awaitingShareTarget = new URL(window.location.href).searchParams.has(
      "share-target"
    );

    if (!awaitingShareTarget) {
      return;
    }

    console.info("Awaiting share target");

    async function effectInner() {
      setProcessingState("processing");
      const file = await getSharedImage();

      if (hasCleanedUp) return;

      // Remove the ?share-target from the URL
      window.history.replaceState("", "", "/");

      await updateCanvas({
        blob: file,
        aspectRatio: initialAspectRatio,
        bgColor: parseColor(initialBgColor.toString("hex")),
        splitType: initialSplitType,
      });
    }

    effectInner();

    return () => {
      hasCleanedUp = true;
      setProcessingState("inert");
    };
  }, [updateCanvas]);

  // Set the width/height of the canvas with the initial aspect ratio
  useEffect(() => {
    const canvasDest = canvasDestRef.current;
    const canvasDestCtx = canvasDest?.getContext("2d");

    if (!canvasDest || !canvasDestCtx) {
      console.error("No destination canvas found!");
      return;
    }

    // Set width/height
    canvasDest.width = initialAspectRatio.width;
    canvasDest.height = initialAspectRatio.height;

    // Then, draw background
    canvasDestCtx.fillStyle = initialBgColor.toString("hex");
    canvasDestCtx.fillRect(
      0,
      0,
      initialAspectRatio.width,
      initialAspectRatio.height
    );
  }, []);

  const changeBgColor = useCallback(
    (newColor: Color) => {
      setBgColor(newColor);
      updateCanvas({
        aspectRatio,
        bgColor: newColor,
        splitType,
      });
    },
    [aspectRatio, splitType, updateCanvas]
  );

  const changeBgColorFromString = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const newColor = parseColor(ev.target.value).toFormat("hsb");
        changeBgColor(newColor);
      } catch (err) {
        // Ignore parse errors, but don't set the colour
      }
    },
    [changeBgColor]
  );

  const changeSplitType = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const newSplitType = ev.target.value as Split;

      setSplitType(newSplitType);

      updateCanvas({
        blob: originalFileRef.current,
        blob2: originalFile2Ref.current,
        aspectRatio,
        bgColor,
        splitType: newSplitType,
      });
    },
    [aspectRatio, bgColor, updateCanvas]
  );

  const changeAspectRatio = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const newAspectRatio = ASPECT_RATIOS[ev.target.value as AspectRatioId];

      if (!newAspectRatio) {
        console.error("Unrecognised aspect ratio:", newAspectRatio);
        return;
      }

      setAspectRatio(newAspectRatio);

      // Make a new resized image from the original file, if needed
      await updateCanvas({
        blob: originalFileRef.current,
        blob2: originalFile2Ref.current,
        aspectRatio: newAspectRatio,
        bgColor,
        splitType,
      });
    },
    [bgColor, splitType, updateCanvas]
  );

  const selectFiles = useCallback(
    async (files: FileWithHandle[]) => {
      // Nothing to do if no files were selected
      if (!files[0]) {
        return;
      }

      // Set the filenames for future reference
      setFilenames([files[0].name, files[1]?.name].filter(Boolean));

      // When the user selects files, we:
      //   1) Run a first-pass downsizing (if needed) to a 2000 pixel fit.
      //      This is more than adequate for our aspect ratios, and ensures faster switching betwen aspect ratios (which resize to fit the box)
      //   2) Store those first-pass results to refs, for future resizing (e.g. changing aspect ratio)
      // Cancel existing tasks and start a new one
      setProcessingState("processing");
      processingAbortController.current?.abort();
      processingAbortController.current = new AbortController();

      const [resizedBlob1, resizedBlob2] = await Promise.all(
        [files[0], files[1]].filter(Boolean).map((file) =>
          resizeToBlob(file, {
            maxWidth: 2000,
            maxHeight: 2000,
            allowUpscale: true,
            signal: processingAbortController.current!.signal,
          })
        )
      );

      // Reset the abort controller, because it is no longer relevant
      processingAbortController.current = undefined;
      setProcessingState("inert");

      // Update canvas data, and redraw
      originalFileRef.current = resizedBlob1;

      // If a second image exists, set it.
      // Otherwise, reset the ref, in case the user wants to override a diptych with a single image.
      if (resizedBlob2) {
        originalFile2Ref.current = resizedBlob2;
      } else {
        originalFile2Ref.current = undefined;
      }

      await updateCanvas({
        blob: resizedBlob1,
        blob2: resizedBlob2,
        aspectRatio: aspectRatio,
        bgColor,
        splitType,
      });
    },
    [aspectRatio, bgColor, splitType, updateCanvas]
  );

  const saveFile = useCallback(() => {
    canvasDestRef.current?.toBlob(
      (blob) => {
        if (blob) {
          fileSave(blob, {
            fileName: makeOutputFilename({
              aspectRatio,
              originalNames: filenames,
            }),
          });
        }
      },
      "image/jpeg",
      0.75
    );
  }, [aspectRatio, filenames]);

  const getFileToShare = useCallback(() => {
    const imageType = "image/jpeg";
    return new Promise<File>((resolve, reject) => {
      canvasDestRef.current?.toBlob(
        (blob) => {
          if (!blob) {
            reject();
            return;
          }

          const file = new File(
            [blob],
            makeOutputFilename({ aspectRatio, originalNames: filenames }),
            { type: imageType }
          );
          resolve(file);
        },
        imageType,
        0.75
      );
    });
  }, [aspectRatio, filenames]);

  return (
    <div className="WorkArea">
      <div className="Controls TopControls">
        <div>
          <fieldset>
            <legend>Aspect Ratio</legend>
            <div className="RadioGroup">
              {Object.values(ASPECT_RATIOS).map((ar) => {
                return (
                  <div className="Radio" key={ar.id}>
                    <input
                      type="radio"
                      name="aspectRatio"
                      id={`${ID.aspectRatioInput}-${ar.id}`}
                      value={ar.id}
                      onChange={changeAspectRatio}
                      defaultChecked={aspectRatio.id === ar.id}
                    />
                    <label htmlFor={`${ID.aspectRatioInput}-${ar.id}`}>
                      {ar.label}
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
        <div>
          <fieldset>
            <legend>Split Type</legend>
            <div className="RadioGroup">
              {splitTypes.map((split) => {
                return (
                  <div className="Radio" key={split.value}>
                    <input
                      type="radio"
                      name="splitType"
                      id={`${ID.splitTypeInput}-${split.value}`}
                      value={split.value}
                      onChange={changeSplitType}
                      defaultChecked={splitType === split.value}
                    />
                    <label htmlFor={`${ID.splitTypeInput}-${split.value}`}>
                      {split.label}
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
        <FilePicker
          onChange={selectFiles}
          multiple
          aria-describedby={ID.filePickerDescription}
        >
          Pick image(s)
        </FilePicker>
        <p id={ID.filePickerDescription}>
          Selecting multiple files will insert the first two as a diptych.
        </p>
      </div>
      <div className="CanvasArea">
        <div className="CanvasWrapper">
          <canvas className="PreviewCanvas" ref={canvasDestRef}></canvas>
          {/* Consolidated loading indicator on top of the canvas */}
          {processingState === "processing" && (
            <div className="LoadingIndicator">Loading...</div>
          )}
          {processingState === "error" && (
            <div className="ErrorIndicator">
              <p>
                Something went wrong when resizing the image. Please try again
                later.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="Controls BottomControls">
        <div>
          <label htmlFor={ID.bgColorInput}>Background Color</label>
          <input
            type="color"
            id={ID.bgColorInput}
            name="bgColor"
            onChange={changeBgColorFromString}
            value={bgColorHex}
          ></input>
          <ExpandableArea label="Custom colors">
            <ErrorBoundary
              fallbackRender={() => (
                <p>Something went wrong when displaying the color picker.</p>
              )}
            >
              <Suspense>
                <LazyCustomColorPicker
                  color={bgColor}
                  onChange={changeBgColor}
                />
              </Suspense>
            </ErrorBoundary>
          </ExpandableArea>
        </div>
        <button className="DownloadButton" type="button" onClick={saveFile}>
          Save
        </button>
        <ShareArea getFileToShare={getFileToShare} />
      </div>
    </div>
  );
}

function ShareArea({
  getFileToShare,
}: {
  getFileToShare: () => Promise<File>;
}) {
  const [shareState, setShareState] = useState<SharingState>("inert");

  const canaryShareFile = useMemo(() => getCanaryEmptyShareFile(), []);

  const shareFile = useCallback(async () => {
    const file = await getFileToShare();

    // It is possible that we support sharing the canary file, but not the final file itself
    // Unlikely, but possible; let's create an error for the user, just in case
    if (SUPPORTS_SHARE && !navigator.canShare({ files: [file] })) {
      console.error(
        "System does not support sharing files, or sharing this type of file."
      );
      setShareState("error");
      return;
    }

    setShareState("sharing");

    navigator
      .share({
        files: [file],
      })
      .then(() => {
        setShareState("success");

        // Give 5 seconds before resetting the state to inert
        setTimeout(() => {
          setShareState("inert");
        }, 5000);
      })
      .catch((err) => {
        // The user aborted picking a file; no need to report this
        if (err instanceof Error && err.name === "AbortError") {
          setShareState("inert");
          return;
        }
        setShareState("error");
        console.error("Error when sharing: ", err);

        setTimeout(() => {
          setShareState("inert");
        }, 5000);
      });
  }, [getFileToShare]);

  if (!SUPPORTS_SHARE || !navigator.canShare({ files: [canaryShareFile] })) {
    return null;
  }

  return (
    <div className="ShareArea">
      <button className="ShareButton" type="button" onClick={shareFile}>
        {shareState === "sharing" ? (
          "Sharing..."
        ) : shareState === "success" ? (
          "Shared!"
        ) : (
          <>
            <PlatformShareIcon />
            <span>Share</span>
          </>
        )}
      </button>
      <div role="status" aria-live="polite">
        {/* The error state is visible */}
        {shareState === "error" && (
          <p>Could not share image. Please try again later.</p>
        )}
        {/* The loading and success states are only used for announcements, but are reflected visually in the button itself */}
        <div className="visuallyHidden">
          {shareState === "success" && "Shared file!"}
          {shareState === "sharing" && "Sharing..."}
        </div>
      </div>
    </div>
  );
}

function makeOutputFilename({
  aspectRatio,
  originalNames,
}: {
  aspectRatio: AspectRatio;
  originalNames?: string[];
}) {
  const joinedNames = originalNames?.join("-");
  const isDiptych = originalNames?.length! > 1 ?? false;
  return [
    "framed",
    isDiptych && "diptych",
    aspectRatio.id,
    joinedNames ?? "canvas",
  ]
    .filter(Boolean)
    .join("-");
}

/**
 * A share icon based on whether we are on Mac/iPhone or other platforms
 * This is imperfect, but close enough
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/platform
 */
function PlatformShareIcon() {
  // Try to use User Agent client hints first, to detect Apple devices
  // @see https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData
  const navigatorUAPlatform = navigator.userAgentData?.platform;
  if (
    navigatorUAPlatform === "macOS" ||
    navigatorUAPlatform === "iPhone" ||
    navigatorUAPlatform === "iPadOS"
  ) {
    return <AppleStyleShareIcon aria-hidden="true" />;
  }

  // If that didn't work, sniff navigator.platform
  if (
    navigator.platform.indexOf("Mac") === 0 ||
    navigator.platform === "iPhone"
  ) {
    return <AppleStyleShareIcon aria-hidden="true" />;
  }

  // Last case, use the Android-style share icon
  return <AndroidStyleShareIcon aria-hidden="true" />;
}

const variants = {
  open: {
    opacity: 1,
  },
  closed: {
    opacity: 0,
  },
};

function ExpandableArea({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="ExpandableArea">
      <button onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
        <ArrowDown />
        {label}
      </button>
      <m.div
        hidden={!isOpen}
        animate={isOpen ? "open" : "closed"}
        variants={variants}
      >
        {children}
      </m.div>
    </div>
  );
}
