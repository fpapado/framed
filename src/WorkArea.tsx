import {
  Share1Icon as AndroidStyleShareIcon,
  Share2Icon as AppleStyleShareIcon,
} from "@radix-ui/react-icons";
import { FileWithHandle, fileSave } from "browser-fs-access";
import {
  useRef,
  useState,
  useId,
  useCallback,
  useEffect,
  useMemo,
} from "react";

import { AspectRatio, AspectRatioId, drawImageWithBackground } from "./drawing";
import { FilePicker } from "./FilePicker";
import { resizeToCanvas } from "./imageResize";
import { getSharedImage } from "./swBridge";
import { getCanaryJpegShareFile } from "./utils/canaryShareFile";

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
const initialBgColor = "#ffffff";

export function WorkArea() {
  // Image canvas, containting data after transforming / scaling, but not the one that we paint on screen
  // Used to share the image between paint methods
  const canvasSrcRef = useRef<HTMLCanvasElement>();

  // Keep a controller to cancel processing, e.g. when the user changes a setting
  const processingAbortController = useRef<AbortController>();

  // A reference to the file the user picked; picking a file does not cause rendering by itself, but actions that change it
  // will typically also redraw on the canvas
  const originalFileRef = useRef<FileWithHandle>();

  // Destination canvas; the one that we manipulate on-screen
  const canvasDestRef = useRef<HTMLCanvasElement>(null);

  // State/options based on user selections
  const [bgColor, setBgColor] = useState(initialBgColor);
  // TODO: This could be a ref, since it doesn't affect rendering per se
  const [filename, setFilename] = useState<string>();
  const [aspectRatio, setAspectRatio] =
    useState<AspectRatio>(initialAspectRatio);

  // Ids and stuff
  const id = useId();
  const ID = {
    bgColorInput: `${id}-bgColor`,
    aspectRatioInput: `${id}-aspectRatio`,
  };

  // Processing state for async operations
  const [processingState, setProcessingState] =
    useState<ProcessingState>("inert");

  // Consolidated loading state, where we want to show the user an indicator; usually when we are re-drawing or resizing
  const isLoading = processingState === "processing";

  const updateCanvas = useCallback(
    async ({
      blob,
      aspectRatio,
      bgColor,
    }: {
      blob?: Blob;
      aspectRatio: AspectRatio;
      bgColor: string;
    }) => {
      try {
        setProcessingState("processing");

        // Resize blob, if one is specified
        if (blob) {
          // Cancel existing tasks and start a new one
          processingAbortController.current?.abort();
          processingAbortController.current = new AbortController();

          const reducedCanvas = await resizeToCanvas(blob, {
            maxWidth: aspectRatio.width - OPTIONS.border * 2,
            maxHeight: aspectRatio.height - OPTIONS.border * 2,
            signal: processingAbortController.current.signal,
          });

          // Reset the abort controller, because it is no longer relevant
          processingAbortController.current = undefined;

          // Update the stored canvas for future operations (e.g. re-drawing after changing colour)
          canvasSrcRef.current = reducedCanvas;
        }

        // Re-draw the image
        drawImageWithBackground({
          canvasSrc: canvasSrcRef.current,
          canvasDest: canvasDestRef.current,
          aspectRatio,
          bgColor,
        });

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

  /** Effect to listen for the share target and receive an image file */
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
        bgColor: initialBgColor,
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
    canvasDestCtx.fillStyle = initialBgColor;
    canvasDestCtx.fillRect(
      0,
      0,
      initialAspectRatio.width,
      initialAspectRatio.height
    );
  }, []);

  const changeBgColor = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = ev.target.value;
      setBgColor(newColor);
      updateCanvas({
        aspectRatio,
        bgColor: newColor,
      });
    },
    [aspectRatio, updateCanvas]
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
        aspectRatio: newAspectRatio,
        bgColor,
      });
    },
    [bgColor, updateCanvas]
  );

  const selectFile = useCallback(
    async (file: FileWithHandle) => {
      // When the user selects a file, we update the source canvas data, and re-draw
      setFilename(file.name);
      originalFileRef.current = file;

      await updateCanvas({
        blob: file,
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
            onChange={changeBgColor}
            value={bgColor}
          ></input>
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
        <FilePicker onChange={selectFile}>Pick image</FilePicker>
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

  const canaryShareFile = useMemo(() => getCanaryJpegShareFile(), []);

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
