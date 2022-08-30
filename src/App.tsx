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

// @ts-ignore
import ImageBlobReduce from "image-blob-reduce";

const reducer = new ImageBlobReduce();

reducer._calculate_size = function (env: any) {
  // Override with a "fit maximally" function
  let scale_factor;

  // Landscape image: scale to fit the width
  if (env.image.width > env.image.height) {
    scale_factor =
      env.opts.maxWidth / Math.max(env.image.width, env.image.height);
  }
  // Portrait image: scale to fit the height
  else if (env.image.width < env.image.height) {
    scale_factor =
      env.opts.maxHeight / Math.max(env.image.width, env.image.height);
  }
  // Landscape image: scale to fit the shortest dimension
  else {
    scale_factor =
      Math.min(env.opts.maxHeight, env.opts.maxWidth) /
      Math.max(env.image.width, env.image.height);
  }

  if (scale_factor > 1) scale_factor = 1;

  env.transform_width = Math.max(Math.round(env.image.width * scale_factor), 1);
  env.transform_height = Math.max(
    Math.round(env.image.height * scale_factor),
    1
  );

  // Info for user plugins, to check if scaling applied
  env.scale_factor = scale_factor;

  return Promise.resolve(env);
};

const OPTIONS = {
  /** Border in pixels */
  border: 64,
  aspectRatio: "4x5" as AspectRatioId,
};

type AspectRatioId = "1x1" | "4x5" | "3x2";
type AspectRatio = {
  id: AspectRatioId;
  label: string;
  width: number;
  height: number;
};

// TODO: Cancelation with pica cancelation token

const ASPECT_RATIOS: Record<AspectRatioId, AspectRatio> = {
  "1x1": {
    label: "Square",
    id: "1x1",
    width: 2000,
    height: 2000,
  },
  "3x2": {
    label: "3x2",
    id: "3x2",
    width: 2000,
    height: 1333,
  },
  "4x5": {
    label: "4x5",
    id: "4x5",
    width: 1600,
    height: 2000,
  },
};

/**
 * Draw an image with a specified background onto a canvas, fitting to the middle
 * @param canvasDest
 */
function drawImageWithBackground({
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
    const orientation =
      canvasSrc.width > canvasSrc.height
        ? "landscape"
        : canvasSrc.width < canvasSrc.height
        ? "portrait"
        : "square";

    let dx = 0;
    let dy = 0;

    if (orientation === "landscape") {
      dx = 0 + OPTIONS.border;
      dy = (aspectRatio.height - canvasSrc.height) / 2;
    } else if (orientation === "portrait") {
      dx = (aspectRatio.width - canvasSrc.width) / 2;
      dy = 0 + OPTIONS.border;
    } else {
      dx = (aspectRatio.width - canvasSrc.width) / 2;
      dy = (aspectRatio.height - canvasSrc.height) / 2;
    }

    canvasDestCtx.drawImage(canvasSrc, dx, dy);
  }
}

function App() {
  const initialAspectRatio = ASPECT_RATIOS[OPTIONS.aspectRatio];
  const initialBgColor = "#ffffff";

  // Image canvas, containting data after transforming / scaling, but not the one that we paint on screen
  // Used to share the image between paint methods
  const canvasSrcRef = useRef<HTMLCanvasElement>();

  // A reference to the file the user picked; picking a file does not cause rendering by itself, but actions that change it
  // will typically also redraw on the canvas
  const originalFileRef = useRef<FileWithHandle>();

  // Destination canvas; the one that we manipulate on-screen
  const canvasDestRef = useRef<HTMLCanvasElement>(null);
  const [hasCanvasData, setHasCanvasData] = useState(false);

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
  const [isResizing, setIsResizing] = useState(false);

  // Consolidated loading state, where we want to show the user an indicator; usually when we are re-drawing or resizing
  const isLoading = isResizing || isDrawTransitionPending;
  const [hasError, setHasError] = useState(false);

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
  }, [initialAspectRatio]);

  const changeBgColor = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      startDrawTransition(() => {
        const newColor = ev.target.value;
        setBgColor(newColor);
        drawImageWithBackground({
          canvasSrc: canvasSrcRef.current,
          canvasDest: canvasDestRef.current,
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
      setIsResizing(true);

      const originalFile = originalFileRef.current;
      if (originalFile) {
        try {
          setHasError(false);
          const reducedCanvas = (await reducer.toCanvas(originalFile, {
            maxWidth: newAspectRatio.width - OPTIONS.border * 2,
            maxHeight: newAspectRatio.height - OPTIONS.border * 2,
          })) as HTMLCanvasElement;

          canvasSrcRef.current = reducedCanvas;
        } catch (err) {
          console.error(err);
          setHasError(true);
        }
      }

      startDrawTransition(() => {
        drawImageWithBackground({
          canvasSrc: canvasSrcRef.current,
          canvasDest: canvasDestRef.current,
          aspectRatio: newAspectRatio,
          bgColor,
        });
      });

      setIsResizing(false);
    },
    [bgColor]
  );

  const selectFile = useCallback(
    async (file: FileWithHandle) => {
      // When the user selects a file, we update the source canvas data, and re-draw
      setFilename(file.name);
      originalFileRef.current = file;

      setIsResizing(true);

      try {
        setHasError(false);
        const reducedCanvas = (await reducer.toCanvas(file, {
          maxWidth: aspectRatio.width - OPTIONS.border * 2,
          maxHeight: aspectRatio.height - OPTIONS.border * 2,
        })) as HTMLCanvasElement;

        canvasSrcRef.current = reducedCanvas;

        setHasCanvasData(true);

        drawImageWithBackground({
          canvasDest: canvasDestRef.current,
          canvasSrc: canvasSrcRef.current,
          aspectRatio: aspectRatio,
          bgColor: bgColor,
        });

        setIsResizing(false);
      } catch (err) {
        console.error(err);
        setIsResizing(false);
        setHasError(true);
      }
    },
    [aspectRatio, bgColor]
  );

  const saveFile = useCallback(() => {
    canvasDestRef.current?.toBlob(
      (blob) => {
        if (blob) {
          fileSave(blob, {
            fileName: filename && `framed-${aspectRatio.id}-${filename}`,
          });
        }
      },
      "image/jpeg",
      0.75
    );
  }, [aspectRatio.id, filename]);

  return (
    <main>
      <h1>Framed</h1>
      <div className="WorkArea">
        <form onSubmit={(ev) => ev.preventDefault} className="Controls">
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
          <FilePicker onChange={selectFile}>Select image</FilePicker>
          <button
            className="DownloadButton"
            type="button"
            onClick={saveFile}
            disabled={!hasCanvasData}
          >
            Save
          </button>
        </form>
        <div className="CanvasArea">
          <div className="CanvasWrapper">
            <canvas
              className={`PreviewCanvas ${
                hasCanvasData ? "PreviewCanvas--hasData" : ""
              }`}
              ref={canvasDestRef}
            ></canvas>
            {/* Consolidated loading indicator on top of the canvas */}
            {isLoading && <div className="LoadingIndicator">Loading...</div>}
            {hasError && (
              <div className="ErrorIndicator">
                <p>
                  Something went wrong when resizing the image. Please try again
                  later
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
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

export default App;
