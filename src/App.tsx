// TODO: Eye dropper for all platforms
// TODO: Share target
// TODO: Custom border
// TODO: Custom size
// TODO: Custom jpeg compression
import "./App.css";

import { fileOpen, FileWithHandle, fileSave } from "browser-fs-access";
import React, {
  useTransition,
  useCallback,
  useId,
  useRef,
  useState,
  PropsWithChildren,
  useEffect,
} from "react";
import * as swBridge from "./swBridge";

import { resizeToCanvas } from "./imageResize";
import { drawImageWithBackground } from "./drawing";

export const SUPPORTS_SHARE = Boolean(navigator.share);

const OPTIONS = {
  /** Border in pixels */
  border: 64,
  aspectRatio: "4x5" as AspectRatioId,
};

type AspectRatioId = "1x1" | "4x5";

export type AspectRatio = {
  id: AspectRatioId;
  label: string;
  width: number;
  height: number;
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
};

type ProcessingState = "inert" | "processing" | "error";

const initialAspectRatio = ASPECT_RATIOS[OPTIONS.aspectRatio];
const initialBgColor = "#ffffff";

function App() {
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

  // Transitions for things that affect the image parameters synchronously
  // These can keep the UI more responsive under load
  const [isDrawTransitionPending, startDrawTransition] = useTransition();

  // Processing state for async operations
  const [processingState, setProcessingState] =
    useState<ProcessingState>("inert");

  // Consolidated loading state, where we want to show the user an indicator; usually when we are re-drawing or resizing
  const isLoading = processingState === "processing" || isDrawTransitionPending;

  const updateResizedCanvas = useCallback(
    async ({
      blob,
      maxWidth,
      maxHeight,
    }: {
      blob?: Blob;
      maxWidth: number;
      maxHeight: number;
    }) => {
      if (blob) {
        try {
          setProcessingState("processing");

          // Cancel existing tasks and start a new one
          processingAbortController.current?.abort();
          processingAbortController.current = new AbortController();

          const reducedCanvas = await resizeToCanvas(blob, {
            maxWidth: maxWidth - OPTIONS.border * 2,
            maxHeight: maxHeight - OPTIONS.border * 2,
            signal: processingAbortController.current.signal,
          });

          // Reset the abort controller, because it is no longer relevant
          processingAbortController.current = undefined;

          // Update the stored canvas for future operations (e.g. re-drawing after changing colour)
          canvasSrcRef.current = reducedCanvas;
          setProcessingState("inert");
        } catch (err) {
          // Ignore error if it is a cancelation error; this is expected
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          console.error(err);
          setProcessingState("error");
        }
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
      const file = await swBridge.getSharedImage();

      if (hasCleanedUp) return;

      // Remove the ?share-target from the URL
      window.history.replaceState("", "", "/");

      await updateResizedCanvas({
        blob: file,
        maxWidth: initialAspectRatio.width - OPTIONS.border * 2,
        maxHeight: initialAspectRatio.height - OPTIONS.border * 2,
      });

      if (hasCleanedUp) return;

      startDrawTransition(() => {
        drawImageWithBackground({
          canvasSrc: canvasSrcRef.current,
          canvasDest: canvasDestRef.current,
          border: OPTIONS.border,
          aspectRatio: initialAspectRatio,
          bgColor: initialBgColor,
        });
        setProcessingState("inert");
      });
    }

    effectInner();

    return () => {
      hasCleanedUp = true;
      setProcessingState("inert");
    };
  }, [updateResizedCanvas]);

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
      startDrawTransition(() => {
        const newColor = ev.target.value;
        setBgColor(newColor);
        drawImageWithBackground({
          canvasSrc: canvasSrcRef.current,
          canvasDest: canvasDestRef.current,
          border: OPTIONS.border,
          aspectRatio,
          bgColor: newColor,
        });
      });
    },
    [aspectRatio]
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
      await updateResizedCanvas({
        blob: originalFileRef.current,
        maxWidth: newAspectRatio.width,
        maxHeight: newAspectRatio.height,
      });

      // Draw the image again
      startDrawTransition(() => {
        drawImageWithBackground({
          canvasSrc: canvasSrcRef.current,
          canvasDest: canvasDestRef.current,
          border: OPTIONS.border,
          aspectRatio: newAspectRatio,
          bgColor,
        });
      });
    },
    [bgColor, updateResizedCanvas]
  );

  const selectFile = useCallback(
    async (file: FileWithHandle) => {
      // When the user selects a file, we update the source canvas data, and re-draw
      setFilename(file.name);
      originalFileRef.current = file;

      await updateResizedCanvas({
        blob: file,
        maxWidth: aspectRatio.width - OPTIONS.border * 2,
        maxHeight: aspectRatio.height - OPTIONS.border * 2,
      });

      startDrawTransition(() => {
        drawImageWithBackground({
          canvasDest: canvasDestRef.current,
          canvasSrc: canvasSrcRef.current,
          border: OPTIONS.border,
          aspectRatio: aspectRatio,
          bgColor: bgColor,
        });
      });
    },
    [aspectRatio, bgColor, updateResizedCanvas]
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

  const shareFile = useCallback(() => {
    const imageType = "image/jpeg";
    canvasDestRef.current?.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File(
          [blob],
          makeOutputFilename({ aspectRatio, originalName: filename }),
          { type: imageType }
        );

        if (
          SUPPORTS_SHARE &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          navigator
            .share({
              files: [file],
            })
            .then(() => {
              console.log("Shared successfully");
            })
            .catch((err) => {
              console.error("Error when sharing: ", err);
            });
        } else {
          console.log("System does not support sharing files");
        }
      },
      imageType,
      0.75
    );
  }, [aspectRatio, filename]);

  return (
    <>
      <main>
        <h1>Framed</h1>
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
            {SUPPORTS_SHARE && (
              <button className="ShareButton" type="button" onClick={shareFile}>
                Share
              </button>
            )}
          </form>
          <div className="CanvasArea">
            <div className="CanvasWrapper">
              <canvas className="PreviewCanvas" ref={canvasDestRef}></canvas>
              {/* Consolidated loading indicator on top of the canvas */}
              {isLoading && <div className="LoadingIndicator">Loading...</div>}
              {processingState === "error" && (
                <div className="ErrorIndicator">
                  <p>
                    Something went wrong when resizing the image. Please try
                    again later.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <footer>
        <footer>
          <p>
            Made with 🎞️ & 😓 by{" "}
            <a
              href="https://fotis.xyz"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fotis Papadogeorgopoulos
            </a>
          </p>
          <p>
            You can use this app offline, by installing it via your browser's
            "Add to Home Screen" functionality.
          </p>
        </footer>
      </footer>
    </>
  );
}

type FilePickerProps = {
  onChange: (file: FileWithHandle) => void;
};

function FilePicker({
  onChange,
  children,
}: PropsWithChildren<FilePickerProps>) {
  const onClick = useCallback(async () => {
    try {
      const blob = await fileOpen({
        mimeTypes: ["image/*"],
        multiple: false,
      });
      onChange(blob);
    } catch (err) {
      // Ignore DOMException; those are thrown when the user does not select a file
      if (err instanceof DOMException) {
        return;
      }
      throw err;
    }
  }, [onChange]);
  return (
    <button type="button" className="FilePicker" onClick={onClick}>
      {children}
    </button>
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

export default App;
