import { fileOpen, FileWithHandle } from "browser-fs-access";
import { AriaAttributes, PropsWithChildren, useCallback } from "react";

type FilePickerProps<M extends boolean | undefined = false> = M extends
  | false
  | undefined
  ? {
      onChange: (file: FileWithHandle) => void;
      multiple?: M;
    }
  : {
      onChange: (file: FileWithHandle[]) => void;
      multiple: M;
    };

export function FilePicker<M extends boolean>({
  onChange,
  multiple,
  children,
  ...rest
}: PropsWithChildren<FilePickerProps<M> & AriaAttributes>) {
  const onClick = useCallback(async () => {
    try {
      const res = await fileOpen({
        mimeTypes: ["image/*"],
        multiple,
      });
      // @ts-expect-error The types line up, but couldn't get them to pass internally
      onChange(res);
    } catch (err) {
      // Ignore DOMException; those are thrown when the user does not select a file
      if (err instanceof DOMException) {
        return;
      }
      throw err;
    }
  }, [multiple, onChange]);
  return (
    <button type="button" className="FilePicker" onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
