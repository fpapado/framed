import { useCallback, useEffect, useState } from "react";
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

export function DarkModeSetting({
  initialPreference,
}: {
  initialPreference: Preference;
}) {
  const [preference, setPreference] = useState<Preference>(initialPreference);

  useEffect(() => {
    setPreference(getPreferenceFromStorage());
  }, []);

  const changeAndStorePreference = useCallback((pref: Preference) => {
    setPreference(pref);
    changeHtmlPreference(pref);
    storePreference(pref);
  }, []);

  return (
    <div className="DarkModeSetting" role="group" aria-label="Colour scheme">
      <button
        aria-pressed={Preferences.is.System(preference)}
        onClick={() => changeAndStorePreference(Preferences.System())}
      >
        {Preferences.is.System(preference) ? (
          <m.div className="background" layoutId="background" />
        ) : null}
        <span className="label">System</span>
      </button>
      <button
        aria-pressed={Preferences.is.AlwaysLight(preference)}
        onClick={() => changeAndStorePreference(Preferences.AlwaysLight())}
      >
        {Preferences.is.AlwaysLight(preference) ? (
          <m.div className="background" layoutId="background" />
        ) : null}
        <span className="label">Light</span>
      </button>
      <button
        aria-pressed={Preferences.is.AlwaysDark(preference)}
        onClick={() => changeAndStorePreference(Preferences.AlwaysDark())}
      >
        {Preferences.is.AlwaysDark(preference) ? (
          <m.div className="background" layoutId="background" />
        ) : null}
        <span className="label">Dark</span>
      </button>
    </div>
  );
}
