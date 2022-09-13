import { ColorSlider } from "@react-spectrum/color";
import type { Color } from "@react-stately/color";
import type { ColorFormat } from "@react-types/color";
import {
  defaultTheme,
  Provider as SpectrumProvider,
} from "@adobe/react-spectrum";
import { useMemo } from "react";

/**
 * A custom color picker component, represented as three sliders, one for each HSL (Hue, Saturation, Lightness) values.
 * Uses @react-spectrum/color under the hood, to ensure that each slider has a good basis for accessibility.
 * This component is provided in cases where input[type=color] is insufficient. For example Firefox on Android and all browsers on iOS have limited paletes to choose from.
 * In those cases, the user may want more control.
 *
 * Note that in other cases, the default input[type=color] is more powerful, because:
 *   a) It might provide a native eye dropper tool (which in the context of this imaging app is very useful!)
 *   b) It might provide alternative representations (based on the native OS), that the user may be more familiar with
 *
 * Thus, it makes sense to offer them side-by-side, in the context of this app.
 *
 * TODO: Also offer a range of colours based on analysing the photo, e.g. via a complementary 6 colours analysis of image data
 * TODO: Pass down color scheme
 *
 * Prefer importing this component lazily, because not all users may require it.
 */
export function CustomColorPicker({
  color,
  onChange,
}: {
  color: Color;
  onChange: (color: Color) => void;
}) {
  /* Convert the color to the correct format, expected by the sliders
   * The sliders throw if the Color is in a format that we do not expect, e.g. if hex or hsl is provided, when we want hsb.
   * There is no way to guard against this with the current types (without a wrapper), and the component will throw as a whole, if that happens.
   * To guard against this, always convert to the expected format here, even if it is a bit wasteful.
   */
  const expectedFormat: ColorFormat = "hsb";
  const asFormat = useMemo(
    () =>
      color.getColorSpace() === expectedFormat
        ? color
        : color.toFormat(expectedFormat),
    [color]
  );
  return (
    <SpectrumProvider theme={defaultTheme} UNSAFE_className="CustomColorPicker">
      <div className="CustomColorPicker-Wrapper">
        <ColorSlider channel="hue" value={asFormat} onChange={onChange} />
        <ColorSlider
          channel="saturation"
          value={asFormat}
          onChange={onChange}
        />
        <ColorSlider
          channel="brightness"
          value={asFormat}
          onChange={onChange}
        />
      </div>
    </SpectrumProvider>
  );
}
