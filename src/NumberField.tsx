import { useRef } from "react";

import { useLocale } from "@react-aria/i18n";

import { useButton, AriaButtonProps } from "@react-aria/button";
import { useNumberField, AriaNumberFieldProps } from "@react-aria/numberfield";
import { useNumberFieldState } from "@react-stately/numberfield";

// FIXME: This is slow / practically inoperable under StrictMode
export function NumberField(props: AriaNumberFieldProps) {
  const { locale } = useLocale();
  console.log({ locale });
  const state = useNumberFieldState({ ...props, locale });
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    labelProps,
    groupProps,
    inputProps,
    incrementButtonProps,
    decrementButtonProps,
  } = useNumberField(props, state, inputRef);

  return (
    <div className="NumberField">
      <label {...labelProps}>{props.label}</label>
      <div className="group" {...groupProps}>
        <Button className="decrement" {...decrementButtonProps}>
          -
        </Button>
        <input {...inputProps} ref={inputRef} />
        <Button className="increment" {...incrementButtonProps}>
          +
        </Button>
      </div>
    </div>
  );
}

function Button({
  className,
  ...props
}: AriaButtonProps<"button"> & { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps, isPressed } = useButton(props, ref);
  const { children } = props;

  const cls = [className, isPressed && "is-pressed"].filter(Boolean).join(" ");

  return (
    <button {...buttonProps} className={cls} ref={ref}>
      {children}
    </button>
  );
}
