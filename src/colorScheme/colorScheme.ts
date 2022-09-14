import { unionize, UnionOf } from "unionize";

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

export function storePreference(pref: Preference) {
  localStorage.setItem(PREFERENCE_KEY, preferenceToString(pref));
}

export function changeHtmlPreference(pref: Preference) {
  document.documentElement.dataset.theme = preferenceToString(pref);
}

export const allPreferences = [
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
