import { useCallback, useId, useState } from "react";
import { unionize, UnionOf } from "unionize";
import { m } from "framer-motion";

export const Preferences = unionize({
  System: {},
  AlwaysLight: {},
  AlwaysDark: {},
});

export type Preference = UnionOf<typeof Preferences>;

const PREFERENCE_KEY = "dark-mode-preference";

function parsePreference(key: string): Preference {
  switch (key) {
    case "alwaysLight":
      return Preferences.AlwaysLight();

    case "alwaysDark":
      return Preferences.AlwaysDark();

    default:
      return Preferences.System();
  }
}

function preferenceToString(pref: Preference) {
  return Preferences.match(pref, {
    AlwaysDark: () => "alwaysDark",
    AlwaysLight: () => "alwaysLight",
    System: () => "system",
  });
}

export function getPreferenceFromStorage() {
  const storedPreference = localStorage.getItem(PREFERENCE_KEY);

  if (!storedPreference) {
    return Preferences.System();
  }

  return parsePreference(storedPreference);
}

function storePreference(pref: Preference) {
  localStorage.setItem(PREFERENCE_KEY, preferenceToString(pref));
}

export function changeHtmlPreference(pref: Preference) {
  document.documentElement.dataset.theme = preferenceToString(pref);
}

const allPreferences = [
  Preferences.System(),
  Preferences.AlwaysLight(),
  Preferences.AlwaysDark(),
].map((preference) => ({
  id: preferenceToString(preference),
  label: Preferences.match(preference, {
    System: () => "System",
    AlwaysLight: () => "Light",
    AlwaysDark: () => "Dark",
  }),
  preference,
}));

export function DarkModeSetting({
  initialPreference,
}: {
  initialPreference: Preference;
}) {
  const groupLabelId = useId();
  const [userPreference, setUserPreference] =
    useState<Preference>(initialPreference);

  const changeAndStorePreference = useCallback((pref: Preference) => {
    setUserPreference(pref);
    changeHtmlPreference(pref);
    storePreference(pref);
  }, []);

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
              onClick={() => changeAndStorePreference(preference)}
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
