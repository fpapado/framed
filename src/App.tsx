import "./App.css";

import { fileOpen, FileWithHandle, fileSave } from "browser-fs-access";
import {
  useTransition,
  useCallback,
  useId,
  useRef,
  useState,
  PropsWithChildren,
} from "react";
// @ts-ignore
import ImageBlobReduce from "image-blob-reduce";

const reducer = new ImageBlobReduce();

const OPTIONS = {
  /** Border in pixels */
  border: 64,
  aspectRatio: "1x1",
  fit: 2000,
};

/**
 * Draw an image with a specified background onto a canvas, fitting to the middle
 * @param canvasDest
 */
function drawImageWithBackground({
  canvasDest,
  canvasSrc,
  bgColor,
}: {
  canvasSrc?: HTMLCanvasElement | null;
  canvasDest: HTMLCanvasElement | null;
  bgColor: string;
}) {
  const canvasDestCtx = canvasDest?.getContext("2d");

  if (!canvasDest || !canvasDestCtx) {
    console.error("No destination canvas found!");
    return;
  }

  // First, draw background
  canvasDestCtx.fillStyle = bgColor;
  canvasDestCtx.fillRect(0, 0, OPTIONS.fit, OPTIONS.fit);

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
      dy = (OPTIONS.fit - canvasSrc.height) / 2;
    } else if (orientation === "portrait") {
      dx = (OPTIONS.fit - canvasSrc.width) / 2;
      dy = 0 + OPTIONS.border;
    } else {
      dx = 0 + OPTIONS.border;
      dy = 0 + OPTIONS.border;
    }

    canvasDestCtx.drawImage(canvasSrc, dx, dy);
  }
}

function App() {
  // Image canvas, containting data after transforming / scaling, but not the one that we paint on screen
  // Used to share the image between paint methods
  const canvasSrcRef = useRef<HTMLCanvasElement>();

  // Destination canvas; the one that we manipulate on-screen
  const canvasDestRef = useRef<HTMLCanvasElement>(null);
  const [hasCanvasData, setHasCanvasData] = useState(false);

  // State/options based on user selections
  const [bgColor, setBgColor] = useState("#ffffff");
  const [filename, setFilename] = useState<string>();

  // Ids and stuff
  const id = useId();
  const ID = {
    bgColorInput: `${id}-bgColor`,
  };

  // Transitions for things that affect the image parameters synchronously
  // These can keep the UI more responsive under load
  const [isDrawTransitionPending, startDrawTransition] = useTransition();
  const [isResizing, setIsResizing] = useState(false);

  // Consolidated loading state, where we want to show the user an indicator; usually when we are re-drawing or resizing
  const isLoading = isResizing || isDrawTransitionPending;

  const changeBgColor = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      startDrawTransition(() => {
        const newColor = ev.target.value;
        setBgColor(newColor);
        drawImageWithBackground({
          canvasSrc: canvasSrcRef.current,
          canvasDest: canvasDestRef.current,
          bgColor: newColor,
        });
      });
    },
    []
  );

  const selectFile = useCallback(
    async (file: FileWithHandle) => {
      // When the user selects a file, we update the source canvas data, and re-draw
      setFilename(file.name);
      setIsResizing(true);

      const reducedCanvas = (await reducer.toCanvas(file, {
        max: OPTIONS.fit - OPTIONS.border * 2,
      })) as HTMLCanvasElement;

      canvasSrcRef.current = reducedCanvas;

      setHasCanvasData(true);

      drawImageWithBackground({
        canvasDest: canvasDestRef.current,
        canvasSrc: canvasSrcRef.current,
        bgColor: bgColor,
      });
      setIsResizing(false);
    },
    [bgColor]
  );

  const saveFile = useCallback(() => {
    canvasDestRef.current?.toBlob(
      (blob) => {
        if (blob) {
          fileSave(blob, {
            fileName: filename && `framed-${OPTIONS.aspectRatio}-${filename}`,
          });
        }
      },
      "image/jpeg",
      0.75
    );
  }, [filename]);

  return (
    <main>
      <h1>Framed</h1>
      <div className="WorkArea">
        <form onSubmit={(ev) => ev.preventDefault}>
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
          <FilePicker onChange={selectFile}>Select image</FilePicker>
        </form>
        <div className="CanvasArea">
          <div className="CanvasWrapper">
            <canvas
              className={`PreviewCanvas ${
                hasCanvasData ? "PreviewCanvas--hasData" : ""
              }`}
              width={OPTIONS.fit}
              height={OPTIONS.fit}
              ref={canvasDestRef}
            ></canvas>
            {/* Consolidated loading indicator on top of the canvas */}
            {isLoading && <div className="LoadingIndicator">Loading...</div>}
          </div>
          <button
            className="DownloadButton"
            type="button"
            onClick={saveFile}
            disabled={!hasCanvasData}
          >
            Save
          </button>
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
