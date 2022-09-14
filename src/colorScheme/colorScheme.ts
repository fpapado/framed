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
  // To reflect the theme preference in HTML, we do two things:
  //  1) Add data-theme too the root, which our styles hook into
  //  2) Remove the specific theme-color meta tags, and add only the one for the theme
  document.documentElement.dataset.theme = preferenceToString(pref);

  document.head
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((el) => el.remove());

  const newMeta = Preferences.match(pref, {
    System: () => [
      { content: "#fffff1", media: "(prefers-color-scheme: light)" },
      { content: "#111111", media: "(prefers-color-scheme: dark)" },
    ],
    AlwaysLight: () => [{ content: "#fffff1" }],
    AlwaysDark: () => [{ content: "#111111" }],
  }) as { content: string; media?: string }[];

  newMeta.forEach(({ content, media }) => {
    const el = document.createElement("meta");
    el.name = "theme-color";
    el.content = content;
    if (!!media) {
      el.media = media;
    }
    document.head.append(el);
  });
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
