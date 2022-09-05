import { fileOpen, FileWithHandle } from "browser-fs-access";
import { PropsWithChildren, useCallback } from "react";

type FilePickerProps = {
  onChange: (file: FileWithHandle) => void;
};

export function FilePicker({
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
