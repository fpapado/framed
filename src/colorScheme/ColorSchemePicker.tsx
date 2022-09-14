import { useId } from "react";
import { allPreferences, Preferences } from "./colorScheme";
import { m } from "framer-motion";
import { useColorSchemeContext } from "./ColorSchemeProvider";

export function ColorSchemePicker() {
  const groupLabelId = useId();
  const [userPreference, setUserPreference] = useColorSchemeContext();

  return (
    <div className="DarkModeSetting">
      <div className="GroupLabel" id={groupLabelId}>
        Theme
      </div>
      <div
        className="DarkModeSetting-Wrapper"
        role="group"
        aria-labelledby={groupLabelId}
      >
        {allPreferences.map(({ id, preference, label }) => {
          const isSelected = Preferences.is[preference.tag](userPreference);
          return (
            <button
              key={id}
              aria-pressed={isSelected}
              onClick={() => setUserPreference(preference)}
            >
              {isSelected ? (
                <m.div className="background" layoutId="background" />
              ) : null}
              <span className="label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
