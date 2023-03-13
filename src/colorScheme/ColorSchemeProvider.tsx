import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  Preferences,
  changeHtmlPreference,
  storePreference,
  type Preference,
} from "./colorScheme";

const ColorSchemeContext = createContext<
  readonly [Preference, (preference: Preference) => void]
>([Preferences.System(), () => {}]);

type Props = {
  initialPreference: Preference;
};

export const useColorSchemeContext = () => useContext(ColorSchemeContext);

export function ColorSchemeProvider({
  initialPreference,
  children,
}: PropsWithChildren<Props>) {
  const [setting, changeSetting] = useState(initialPreference);

  const changeAndStorePreference = useCallback((pref: Preference) => {
    changeSetting(pref);
    changeHtmlPreference(pref);
    storePreference(pref);
  }, []);

  const contextValue = useMemo(() => {
    return [setting, changeAndStorePreference] as const;
  }, [changeAndStorePreference, setting]);

  return (
    <ColorSchemeContext.Provider value={contextValue}>
      {children}
    </ColorSchemeContext.Provider>
  );
}
