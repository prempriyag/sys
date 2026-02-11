import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, getAuthToken } from "../config/api";

type ThemeColorContextType = {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  logoIconUrl: string;
  setLogoIconUrl: (url: string) => void;
  logoLightUrl: string;
  setLogoLightUrl: (url: string) => void;
  logoDarkUrl: string;
  setLogoDarkUrl: (url: string) => void;
  headerBgColor: string;
  setHeaderBgColor: (color: string) => void;
  headerTextColor: string;
  setHeaderTextColor: (color: string) => void;
  sidebarBgColor: string;
  setSidebarBgColor: (color: string) => void;
  sidebarTextColor: string;
  setSidebarTextColor: (color: string) => void;
  updateThemeColor: (color: string) => void;
  updateColors: () => void;
};

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined);

export const ThemeColorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [primaryColor, setPrimaryColorState] = useState<string>("#e57124"); // Default brand-500
  const [logoUrl, setLogoUrlState] = useState<string>("/images/logo/logo.svg");
  const [logoIconUrl, setLogoIconUrlState] = useState<string>("/images/logo/logo-icon.svg");
  const [logoLightUrl, setLogoLightUrlState] = useState<string>("/images/logo/connors-color.png");
  const [logoDarkUrl, setLogoDarkUrlState] = useState<string>("/images/logo/connors-white.png");
  const [headerBgColor, setHeaderBgColorState] = useState<string>("#ffffff");
  const [headerTextColor, setHeaderTextColorState] = useState<string>("#1d2939");
  const [sidebarBgColor, setSidebarBgColorState] = useState<string>("#ffffff");
  const [sidebarTextColor, setSidebarTextColorState] = useState<string>("#1d2939");
  const [isDark, setIsDark] = useState<boolean>(false);

  // Monitor dark mode changes
  useEffect(() => {
    const updateDarkMode = () => {
      const darkMode = document.documentElement.classList.contains("dark");
      setIsDark(darkMode);
    };

    // Initial check
    updateDarkMode();

    // Watch for dark mode changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          updateDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Load saved theme color and logos from localStorage on mount
  useEffect(() => {
    const savedColor = localStorage.getItem("themeColor");
    const savedLogo = localStorage.getItem("logoUrl");
    const savedLogoIcon = localStorage.getItem("logoIconUrl");
    const savedLogoLight = localStorage.getItem("logoLightUrl");
    const savedLogoDark = localStorage.getItem("logoDarkUrl");
    const savedHeaderBg = localStorage.getItem("headerBgColor");
    const savedHeaderText = localStorage.getItem("headerTextColor");
    const savedSidebarBg = localStorage.getItem("sidebarBgColor");
    const savedSidebarText = localStorage.getItem("sidebarTextColor");
    
    if (savedColor && savedColor !== "#465fff") {
      // Use saved color (skip old blue default)
      setPrimaryColorState(savedColor);
      updateCSSVariables(savedColor);
    } else {
      // Initialize with default color if no saved color or old blue default
      const defaultColor = "#e57124";
      setPrimaryColorState(defaultColor);
      localStorage.setItem("themeColor", defaultColor);
      updateCSSVariables(defaultColor);
    }
    
    if (savedLogo) setLogoUrlState(savedLogo);
    if (savedLogoIcon) setLogoIconUrlState(savedLogoIcon);
    if (savedLogoLight) setLogoLightUrlState(savedLogoLight);
    if (savedLogoDark) setLogoDarkUrlState(savedLogoDark);
    if (savedHeaderBg) setHeaderBgColorState(savedHeaderBg);
    if (savedHeaderText) setHeaderTextColorState(savedHeaderText);
    if (savedSidebarBg) setSidebarBgColorState(savedSidebarBg);
    if (savedSidebarText) setSidebarTextColorState(savedSidebarText);
  }, []);

  // Apply colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--header-bg-color", headerBgColor);
    root.style.setProperty("--header-text-color", headerTextColor);
    root.style.setProperty("--sidebar-bg-color", sidebarBgColor);
    root.style.setProperty("--sidebar-text-color", sidebarTextColor);
  }, [headerBgColor, headerTextColor, sidebarBgColor, sidebarTextColor]);

  const updateCSSVariables = (color: string) => {
    // Convert hex to RGB for CSS variables
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate color shades
    const shades = {
      25: `rgb(${Math.min(255, r + 230)}, ${Math.min(255, g + 230)}, ${Math.min(255, b + 230)})`,
      50: `rgb(${Math.min(255, r + 200)}, ${Math.min(255, g + 200)}, ${Math.min(255, b + 200)})`,
      100: `rgb(${Math.min(255, r + 150)}, ${Math.min(255, g + 150)}, ${Math.min(255, b + 150)})`,
      200: `rgb(${Math.min(255, r + 100)}, ${Math.min(255, g + 100)}, ${Math.min(255, b + 100)})`,
      300: `rgb(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)})`,
      400: `rgb(${Math.min(255, r + 20)}, ${Math.min(255, g + 20)}, ${Math.min(255, b + 20)})`,
      500: color,
      600: `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`,
      700: `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`,
      800: `rgb(${Math.max(0, r - 60)}, ${Math.max(0, g - 60)}, ${Math.max(0, b - 60)})`,
      900: `rgb(${Math.max(0, r - 80)}, ${Math.max(0, g - 80)}, ${Math.max(0, b - 80)})`,
      950: `rgb(${Math.max(0, r - 100)}, ${Math.max(0, g - 100)}, ${Math.max(0, b - 100)})`,
    };

    // Calculate light gradient colors - much lighter/brighter for light mode
    const lightGradient1 = `rgb(${Math.min(255, r + 245)}, ${Math.min(255, g + 245)}, ${Math.min(255, b + 245)})`;
    const lightGradient2 = `rgb(${Math.min(255, r + 240)}, ${Math.min(255, g + 240)}, ${Math.min(255, b + 240)})`;
    const lightGradient3 = `rgb(${Math.min(255, r + 248)}, ${Math.min(255, g + 248)}, ${Math.min(255, b + 248)})`;

    // Calculate dark gradient colors - keep neutral dark tones to avoid theme tinting
    const darkGradient1 = "#0f172a";
    const darkGradient2 = "#1e293b";
    const darkGradient3 = "#1a1a2e";

    // Update CSS variables
    const root = document.documentElement;
    Object.entries(shades).forEach(([shade, value]) => {
      root.style.setProperty(`--color-brand-${shade}`, value);
    });

    // Update gradient colors
    root.style.setProperty("--gradient-light-1", lightGradient1);
    root.style.setProperty("--gradient-light-2", lightGradient2);
    root.style.setProperty("--gradient-light-3", lightGradient3);
    root.style.setProperty("--gradient-dark-1", darkGradient1);
    root.style.setProperty("--gradient-dark-2", darkGradient2);
    root.style.setProperty("--gradient-dark-3", darkGradient3);
    
    // Force browser to recalculate styles by triggering a DOM reflow
    // This is crucial for dark mode to pick up new colors
    if (root.classList.contains("dark")) {
      // If in dark mode, temporarily remove and re-add dark class to force recalculation
      root.classList.remove("dark");
      // Force the browser to recalculate styles
      void root.offsetHeight;
      root.classList.add("dark");
    } else {
      // For light mode, use style property toggle
      const originalDisplay = root.style.display;
      root.style.display = "none";
      // Force the browser to recalculate
      void root.offsetHeight;
      root.style.display = originalDisplay;
    }
    
    // Note: We intentionally do NOT set body-bg, white, or white-theme colors here
    // to keep cards and backgrounds neutral white, preventing unwanted tinting
    // Theme color is only used for accent elements (buttons, borders, icons, etc.)
  };

  const setPrimaryColor = (color: string) => {
    setPrimaryColorState(color);
    localStorage.setItem("themeColor", color);
    updateCSSVariables(color);
  };

  const updateThemeColor = (color: string) => {
    setPrimaryColor(color);
  };

  const setLogoUrl = (url: string) => {
    setLogoUrlState(url);
    localStorage.setItem("logoUrl", url);
  };

  const setLogoIconUrl = (url: string) => {
    setLogoIconUrlState(url);
    localStorage.setItem("logoIconUrl", url);
  };

  const setLogoLightUrl = (url: string) => {
    setLogoLightUrlState(url);
    localStorage.setItem("logoLightUrl", url);
  };

  const setLogoDarkUrl = (url: string) => {
    setLogoDarkUrlState(url);
    localStorage.setItem("logoDarkUrl", url);
  };

  const setHeaderBgColor = (color: string) => {
    setHeaderBgColorState(color);
    localStorage.setItem("headerBgColor", color);
  };

  const setHeaderTextColor = (color: string) => {
    setHeaderTextColorState(color);
    localStorage.setItem("headerTextColor", color);
  };

  const setSidebarBgColor = (color: string) => {
    setSidebarBgColorState(color);
    localStorage.setItem("sidebarBgColor", color);
  };

  const setSidebarTextColor = (color: string) => {
    setSidebarTextColorState(color);
    localStorage.setItem("sidebarTextColor", color);
  };

  const updateColors = () => {
    // Re-apply all colors
    updateCSSVariables(primaryColor);
    const root = document.documentElement;
    root.style.setProperty("--header-bg-color", headerBgColor);
    root.style.setProperty("--header-text-color", headerTextColor);
    root.style.setProperty("--sidebar-bg-color", sidebarBgColor);
    root.style.setProperty("--sidebar-text-color", sidebarTextColor);
  };

  // Computed colors that adapt to dark mode
  const computedHeaderBgColor = isDark ? "#1f2937" : headerBgColor; // gray-800 in dark mode
  const computedHeaderTextColor = isDark ? "#f9fafb" : headerTextColor; // gray-50 in dark mode
  const computedSidebarBgColor = isDark ? "#1f2937" : sidebarBgColor; // gray-800 in dark mode
  const computedSidebarTextColor = isDark ? "#f9fafb" : sidebarTextColor; // gray-50 in dark mode

  return (
    <ThemeColorContext.Provider
      value={{
        primaryColor,
        setPrimaryColor,
        logoUrl,
        setLogoUrl,
        logoIconUrl,
        setLogoIconUrl,
        logoLightUrl,
        setLogoLightUrl,
        logoDarkUrl,
        setLogoDarkUrl,
        headerBgColor: computedHeaderBgColor, // Use computed color
        setHeaderBgColor,
        headerTextColor: computedHeaderTextColor, // Use computed color
        setHeaderTextColor,
        sidebarBgColor: computedSidebarBgColor, // Use computed color
        setSidebarBgColor,
        sidebarTextColor: computedSidebarTextColor, // Use computed color
        setSidebarTextColor,
        updateThemeColor,
        updateColors,
      }}
    >
      {children}
    </ThemeColorContext.Provider>
  );
};

export const useThemeColor = () => {
  const context = useContext(ThemeColorContext);
  if (context === undefined) {
    throw new Error("useThemeColor must be used within a ThemeColorProvider");
  }
  return context;
};
