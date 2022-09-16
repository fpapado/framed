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
} from "./drawing";
import { FilePicker } from "./FilePicker";
import { AndroidStyleShareIcon } from "./icons/AndroidStyleShareIcon";
import { AppleStyleShareIcon } from "./icons/AppleStyleShareIcon";
import { ArrowDown } from "./icons/ArrowDown";
import { resizeToCanvas } from "./imageResize";
import { getSharedImage } from "./swBridge";
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
const initialBgColor = parseColor("hsb(0, 0%, 100%)");

export function WorkArea() {
  // Image canvas, containting data after transforming / scaling, but not the one that we paint on screen
  // Used to share the image between paint methods
  const canvasSrcRef = useRef<HTMLCanvasElement>();
  const canvasSrc2Ref = useRef<HTMLCanvasElement>();

  // Keep a controller to cancel processing, e.g. when the user changes a setting
  const processingAbortController = useRef<AbortController>();
  const processing2AbortController = useRef<AbortController>();

  // A reference to the file the user picked; picking a file does not cause rendering by itself, but actions that change it
  // will typically also redraw on the canvas
  const originalFileRef = useRef<FileWithHandle>();
  const originalFile2Ref = useRef<FileWithHandle>();

  // Destination canvas; the one that we manipulate on-screen
  const canvasDestRef = useRef<HTMLCanvasElement>(null);

  // State/options based on user selections
  const [bgColor, setBgColor] = useState(initialBgColor);

  const bgColorHex = useMemo(() => bgColor.toString("hex"), [bgColor]);

  // TODO: This could be a ref, since it doesn't affect rendering per se
  const [filename, setFilename] = useState<string>();
  const [aspectRatio, setAspectRatio] =
    useState<AspectRatio>(initialAspectRatio);

  // Ids and stuff
  const id = useId();
  const ID = {
    bgColorInput: `${id}-bgColor`,
    aspectRatioInput: `${id}-aspectRatio`,
    filePickerDescription: `${id}-filePickerDescription`,
  };

  // Processing state for async operations
  const [processingState, setProcessingState] =
    useState<ProcessingState>("inert");

  // Consolidated loading state, where we want to show the user an indicator; usually when we are re-drawing or resizing
  const isLoading = processingState === "processing";

  const updateCanvas = useCallback(
    async ({
      blob,
      blob2,
      aspectRatio,
      bgColor,
    }: {
      blob?: Blob;
      blob2?: Blob;
      aspectRatio: AspectRatio;
      bgColor: Color;
    }) => {
      try {
        setProcessingState("processing");

        // We are rendering a diptych if either:
        const isDiptych = !!(
          // Both new images provided
          (
            (blob && blob2) ||
            // New first image and old second one
            (blob && canvasSrc2Ref.current) ||
            // New second image and old first one
            (blob2 && canvasSrcRef.current) ||
            // Both old images (e.g. updating background color)
            (canvasSrcRef.current && canvasSrc2Ref.current)
          )
        );

        // Resize images, if new ones are specified (e.g. picked new image, or aspect ratio changed)
        // Cancel existing tasks and start a new one
        processingAbortController.current?.abort();
        processingAbortController.current = new AbortController();

        const [resizedCanvas1, resizedCanvas2] = await Promise.all([
          blob &&
            resizeToCanvas(blob, {
              maxWidth: isDiptych
                ? (aspectRatio.width - OPTIONS.border) / 2
                : aspectRatio.width - OPTIONS.border * 2,
              maxHeight: isDiptych
                ? aspectRatio.height - OPTIONS.border
                : aspectRatio.height - OPTIONS.border / 2,
              signal: processingAbortController.current.signal,
            }),
          blob2 &&
            resizeToCanvas(blob2, {
              maxWidth: isDiptych
                ? (aspectRatio.width - OPTIONS.border) / 2
                : aspectRatio.width - OPTIONS.border * 2,
              maxHeight: isDiptych
                ? aspectRatio.height - OPTIONS.border
                : aspectRatio.height - OPTIONS.border / 2,
              signal: processingAbortController.current.signal,
            }),
        ]);

        // Reset the abort controller, because it is no longer relevant
        processingAbortController.current = undefined;

        // If the canvases were updated, update the stored canvas refs for future operations (e.g. re-drawing after changing colour)
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
   * TODO: Support two shared images
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
      });
    },
    [aspectRatio, updateCanvas]
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
      });
    },
    [bgColor, updateCanvas]
  );

  const selectFiles = useCallback(
    async (files: FileWithHandle[]) => {
      if (!files[0]) {
        return;
      }
      // When the user selects a file, we update the source canvas data, and re-draw
      setFilename(files[0].name);
      originalFileRef.current = files[0];

      if (files[1]) {
        originalFile2Ref.current = files[1];
      }

      await updateCanvas({
        blob: files[0],
        blob2: files[1],
        aspectRatio: aspectRatio,
        bgColor,
      });
    },
    [aspectRatio, bgColor, updateCanvas]
  );

  const saveFile = useCallback(() => {
    canvasDestRef.current?.toBlob(
      (blob) => {
        if (blob) {
          fileSave(blob, {
            fileName: makeOutputFilename({
              aspectRatio,
              originalName: filename,
            }),
          });
        }
      },
      "image/jpeg",
      0.75
    );
  }, [aspectRatio, filename]);

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
            makeOutputFilename({ aspectRatio, originalName: filename }),
            { type: imageType }
          );
          resolve(file);
        },
        imageType,
        0.75
      );
    });
  }, [aspectRatio, filename]);

  return (
    <div className="WorkArea">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
        }}
        className="Controls"
      >
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
        <button className="DownloadButton" type="button" onClick={saveFile}>
          Save
        </button>
        <ShareArea getFileToShare={getFileToShare} />
      </form>
      <div className="CanvasArea">
        <div className="CanvasWrapper">
          <canvas className="PreviewCanvas" ref={canvasDestRef}></canvas>
          {/* Consolidated loading indicator on top of the canvas */}
          {isLoading && <div className="LoadingIndicator">Loading...</div>}
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
        "System does not support sharing files, or this type of file"
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
  originalName,
}: {
  aspectRatio: AspectRatio;
  originalName?: string;
}) {
  return `framed-${aspectRatio.id}-${originalName ? originalName : "canvas"}`;
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
