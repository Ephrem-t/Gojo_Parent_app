import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const THEME_STORAGE_KEY = "parent_app_theme_mode";
const THEME_PREFERENCE_STORAGE_KEY = "parent_app_theme_mode_explicit";
const LANGUAGE_STORAGE_KEY = "parent_app_language";
const DEFAULT_THEME_MODE: ThemeMode = "light";

type ThemeMode = "light" | "dark";
type LanguageCode = "en" | "am" | "om" | "ti";

const lightTheme = {
  mode: "light" as ThemeMode,
  isDark: false,
  statusBarStyle: "dark-content",
  expoStatusBarStyle: "dark",
  navigationBarButtonStyle: "dark",
  colors: {
    primary: "#2296F3",
    primaryDark: "#0B72C7",
    primarySoft: "#EAF5FF",
    primarySoftAlt: "#EEF5FF",
    background: "#FFFFFF",
    backgroundAlt: "#F6F8FC",
    card: "#FFFFFF",
    cardMuted: "#F8FBFF",
    inputBackground: "#F8FAFC",
    surfaceMuted: "#F1F5F9",
    infoSurface: "#EAF3FF",
    infoBorder: "#CFE0FF",
    text: "#0F172A",
    textStrong: "#11181C",
    muted: "#64748B",
    mutedAlt: "#6B7894",
    border: "#E5EDF5",
    borderSoft: "#EFF4FA",
    borderStrong: "#DDE8F7",
    line: "#F1F5F9",
    lineSoft: "#EEF4FF",
    white: "#FFFFFF",
    black: "#000000",
    success: "#16A34A",
    successSoft: "#ECFDF3",
    warning: "#F59E0B",
    warningSoft: "#FFF7ED",
    danger: "#E53935",
    dangerSoft: "#FEECEC",
    offline: "#94A3B8",
    avatarPlaceholder: "#E5E7EB",
    overlay: "rgba(2,6,23,0.35)",
    overlayStrong: "rgba(15,23,42,0.45)",
    heroSurface: "#FFFFFF",
    heroBannerTint: "#F6FAFF",
    heroOrbPrimary: "rgba(34,150,243,0.08)",
    heroOrbSecondary: "rgba(34,150,243,0.05)",
    heroTopButton: "rgba(15,23,42,0.38)",
    heroTopButtonAlt: "rgba(15,23,42,0.34)",
    heroTopBorder: "rgba(255,255,255,0.16)",
    heroPillBg: "rgba(15,23,42,0.55)",
    heroPillBorder: "rgba(255,255,255,0.14)",
    heroPillText: "#F8FAFC",
    heroSubtleText: "#DBEAFE",
    tabBar: "#FFFFFF",
    tabBarSurface: "rgba(255,255,255,0.9)",
    tabBarBorder: "rgba(221,228,240,0.95)",
    tabBarHighlight: "rgba(255,255,255,0.72)",
    tabBarActive: "rgba(0,122,251,0.08)",
    tabInactive: "#6B7280",
    chatIncoming: "#F6F7FB",
    chatOutgoing: "#007AFB",
    chatIncomingText: "#111827",
    chatOutgoingText: "#FFFFFF",
    splashGradientTop: "#2563EB",
    splashGradientBottom: "#F7F9FC",
    splashBrand: "#111827",
    splashSpinner: "#2563EB",
  },
};

const darkTheme = {
  mode: "dark" as ThemeMode,
  isDark: true,
  statusBarStyle: "light-content",
  expoStatusBarStyle: "light",
  navigationBarButtonStyle: "light",
  colors: {
    primary: "#56B0FF",
    primaryDark: "#8CCBFF",
    primarySoft: "#102742",
    primarySoftAlt: "#122D4B",
    background: "#07111F",
    backgroundAlt: "#0B1627",
    card: "#0F1B2D",
    cardMuted: "#122035",
    inputBackground: "#111E30",
    surfaceMuted: "#162235",
    infoSurface: "#102B46",
    infoBorder: "#24496B",
    text: "#E5EEF8",
    textStrong: "#F4F8FC",
    muted: "#94A3B8",
    mutedAlt: "#A5B4C7",
    border: "#223247",
    borderSoft: "#1C2A3D",
    borderStrong: "#2C4564",
    line: "#203047",
    lineSoft: "#1B2A40",
    white: "#FFFFFF",
    black: "#000000",
    success: "#34D399",
    successSoft: "#083A2A",
    warning: "#FBBF24",
    warningSoft: "#3B2A0B",
    danger: "#F87171",
    dangerSoft: "#401818",
    offline: "#64748B",
    avatarPlaceholder: "#233245",
    overlay: "rgba(1,4,9,0.64)",
    overlayStrong: "rgba(1,4,9,0.78)",
    heroSurface: "#0F1B2D",
    heroBannerTint: "#0E243D",
    heroOrbPrimary: "rgba(86,176,255,0.18)",
    heroOrbSecondary: "rgba(96,165,250,0.12)",
    heroTopButton: "rgba(8,24,46,0.62)",
    heroTopButtonAlt: "rgba(8,24,46,0.62)",
    heroTopBorder: "rgba(255,255,255,0.12)",
    heroPillBg: "rgba(8,24,46,0.68)",
    heroPillBorder: "rgba(255,255,255,0.1)",
    heroPillText: "#EAF4FF",
    heroSubtleText: "#C8DBF6",
    tabBar: "#0C1728",
    tabBarSurface: "rgba(12,23,40,0.92)",
    tabBarBorder: "rgba(34,50,71,0.95)",
    tabBarHighlight: "rgba(255,255,255,0.08)",
    tabBarActive: "rgba(86,176,255,0.14)",
    tabInactive: "#8AA0B8",
    chatIncoming: "#162235",
    chatOutgoing: "#1D6FD6",
    chatIncomingText: "#E5EEF8",
    chatOutgoingText: "#FFFFFF",
    splashGradientTop: "#08111F",
    splashGradientBottom: "#163A67",
    splashBrand: "#EAF4FF",
    splashSpinner: "#56B0FF",
  },
};

type ParentThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  statusBarStyle: string;
  expoStatusBarStyle: string;
  navigationBarButtonStyle: string;
  colors: typeof lightTheme.colors;
  loaded: boolean;
  languageCode: LanguageCode;
  amharic: boolean;
  oromo: boolean;
  tigrinya: boolean;
  setThemeMode: (nextMode: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguageCode: (nextLanguageCode: LanguageCode) => void;
  toggleLanguage: () => void;
};

const ParentThemeContext = createContext<ParentThemeContextValue>({
  ...lightTheme,
  loaded: false,
  languageCode: "en",
  amharic: false,
  oromo: false,
  tigrinya: false,
  setThemeMode: () => {},
  toggleTheme: () => {},
  setLanguageCode: () => {},
  toggleLanguage: () => {},
});

export function ParentThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [hasExplicitThemePreference, setHasExplicitThemePreference] = useState(false);
  const [languageCode, setLanguageCodeState] = useState<LanguageCode>("en");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [savedMode, savedThemePreference, savedLanguageCode] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY),
          AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
        ]);
        if (!mounted) return;

        const hasSavedThemePreference = savedThemePreference === "1";
        setHasExplicitThemePreference(hasSavedThemePreference);

        if (hasSavedThemePreference && (savedMode === "light" || savedMode === "dark")) {
          setMode(savedMode);
        } else {
          setMode(DEFAULT_THEME_MODE);
        }

        if (savedLanguageCode === "en" || savedLanguageCode === "am" || savedLanguageCode === "om" || savedLanguageCode === "ti") {
          setLanguageCodeState(savedLanguageCode);
        }
      } catch {}
      if (mounted) setLoaded(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const theme = mode === "dark" ? darkTheme : lightTheme;
  const amharic = languageCode === "am" || languageCode === "ti";
  const oromo = languageCode === "om";
  const tigrinya = languageCode === "ti";

  useEffect(() => {
    AsyncStorage.multiSet([
      [THEME_STORAGE_KEY, mode],
      [THEME_PREFERENCE_STORAGE_KEY, hasExplicitThemePreference ? "1" : "0"],
      [LANGUAGE_STORAGE_KEY, languageCode],
    ]).catch(() => {});
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [hasExplicitThemePreference, languageCode, mode, theme.colors.background]);

  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    if (nextMode === "dark" || nextMode === "light") {
      setHasExplicitThemePreference(true);
      setMode(nextMode);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setHasExplicitThemePreference(true);
    setMode((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const setLanguageCode = useCallback((nextLanguageCode: LanguageCode) => {
    if (nextLanguageCode === "en" || nextLanguageCode === "am" || nextLanguageCode === "om" || nextLanguageCode === "ti") {
      setLanguageCodeState(nextLanguageCode);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageCodeState((current) => {
      if (current === "en") return "am";
      if (current === "am") return "om";
      if (current === "om") return "ti";
      return "en";
    });
  }, []);

  const value = useMemo(
    () => ({
      ...theme,
      loaded,
      languageCode,
      amharic,
      oromo,
      tigrinya,
      setThemeMode,
      toggleTheme,
      setLanguageCode,
      toggleLanguage,
    }),
    [theme, loaded, languageCode, amharic, oromo, tigrinya, setThemeMode, toggleTheme, setLanguageCode, toggleLanguage]
  );

  return <ParentThemeContext.Provider value={value}>{children}</ParentThemeContext.Provider>;
}

export function useParentTheme() {
  return useContext(ParentThemeContext);
}
