import { track, useAtom } from "signia-react";

import {
  ASPECT_RATIOS,
  Canvas,
  initialAspectRatio,
  initialBgColor,
  ProcessingState,
  splitTypes,
} from "./Canvas";
import { parseColor } from "@react-stately/color";
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

import { AspectRatio, AspectRatioId, Split } from "./drawing";
import { FilePicker } from "./FilePicker";
import { AndroidStyleShareIcon } from "./icons/AndroidStyleShareIcon";
import { AppleStyleShareIcon } from "./icons/AppleStyleShareIcon";
import { ArrowDown } from "./icons/ArrowDown";
import { getSharedImage } from "./serviceWorker/swBridge";
import { getCanaryEmptyShareFile } from "./utils/canaryShareFile";
import { NumberField } from "./NumberField";

const LazyCustomColorPicker = lazy(() =>
  import("./CustomColorPicker").then((m) => ({ default: m.CustomColorPicker }))
);

const SUPPORTS_SHARE = Boolean(navigator.share);
type SharingState = "inert" | "sharing" | "error" | "success";

export const WorkArea = track(function WorkArea() {
  const canvas = useMemo(() => new Canvas(), []);
  const processingState = useAtom<ProcessingState>("processingState", "inert");

  // Destination canvas; the one that we manipulate on-screen
  const canvasDestRef = useRef<HTMLCanvasElement>(null);
  const filenames = useRef<string[] | undefined>();

  // Ids and stuff
  const id = useId();
  const ID = {
    bgColorInput: `${id}-bgColor`,
    aspectRatioInput: `${id}-aspectRatio`,
    splitTypeInput: `${id}-aspectRatio`,
    filePickerDescription: `${id}-filePickerDescription`,
  };

  // The main effect; drawing on the destination canvas when the internal effect graph changes
  useEffect(() => {
    if (!canvasDestRef.current) {
      console.error("No destination canvas found!");
      return;
    }
    return canvas.drawOnCanvas(canvasDestRef.current);
  }, [canvas]);

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
      processingState.set("processing");
      const file = await getSharedImage();

      if (hasCleanedUp) return;

      // Remove the ?share-target from the URL
      window.history.replaceState("", "", "/");
      canvas.setBlobs(file);
    }

    effectInner();

    return () => {
      hasCleanedUp = true;
      processingState.set("inert");
    };
  }, [canvas, processingState]);

  const changeBgColorFromString = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const newColor = parseColor(ev.target.value).toFormat("hsb");
        canvas.setBgColor(newColor);
      } catch (err) {
        // Ignore parse errors, but don't set the colour
      }
    },
    [canvas]
  );

  const changeSplitType = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const newSplitType = ev.target.value as Split;
      canvas.setSplitType(newSplitType);
    },
    [canvas]
  );

  const setBorder = useCallback(
    (newBorder: number) => {
      canvas.setBorder(newBorder);
    },
    [canvas]
  );

  const changeAspectRatio = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const newAspectRatio = ASPECT_RATIOS[ev.target.value as AspectRatioId];

      if (!newAspectRatio) {
        console.error("Unrecognised aspect ratio:", newAspectRatio);
        return;
      }

      canvas.setAspectRatio(newAspectRatio);
    },
    [canvas]
  );

  const selectFiles = useCallback(
    async (files: FileWithHandle[]) => {
      // Nothing to do if no files were selected
      if (!files[0]) {
        return;
      }

      // Set the filenames for future reference
      filenames.current = [files[0].name, files[1]?.name].filter(Boolean);

      processingState.set("processing");

      await canvas.setBlobs(files[0], files[1]);

      processingState.set("inert");
    },
    [canvas, processingState]
  );

  const saveFile = useCallback(() => {
    canvasDestRef.current?.toBlob(
      (blob) => {
        if (blob) {
          fileSave(blob, {
            fileName: makeOutputFilename({
              aspectRatio: canvas.aspectRatio,
              originalNames: filenames.current,
            }),
          });
        }
      },
      "image/jpeg",
      0.75
    );
  }, [canvas.aspectRatio]);

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
            makeOutputFilename({
              aspectRatio: canvas.aspectRatio,
              originalNames: filenames.current,
            }),
            { type: imageType }
          );
          resolve(file);
        },
        imageType,
        0.75
      );
    });
  }, [canvas.aspectRatio]);

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
                      defaultChecked={canvas.aspectRatio.id === ar.id}
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
                      defaultChecked={canvas.splitType === split.value}
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
        <NumberField
          label="Border (pixels)"
          minValue={0}
          maxValue={500}
          value={canvas.border}
          onChange={setBorder}
        />
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
          {processingState.value === "processing" && (
            <div className="LoadingIndicator">Loading...</div>
          )}
          {processingState.value === "error" && (
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
            value={canvas.colorHex}
          />
          <ExpandableArea label="Custom colors">
            <ErrorBoundary
              fallbackRender={() => (
                <p>Something went wrong when displaying the color picker.</p>
              )}
            >
              <Suspense>
                <LazyCustomColorPicker
                  color={canvas.bgColor}
                  onChange={(color) => canvas.setBgColor(color)}
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
});

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
  const isDiptych = Array.isArray(originalNames) && originalNames.length > 1;
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
