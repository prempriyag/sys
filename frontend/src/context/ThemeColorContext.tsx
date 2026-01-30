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
  const [primaryColor, setPrimaryColorState] = useState<string>("#465fff"); // Default brand-500
  const [logoUrl, setLogoUrlState] = useState<string>("/images/logo/logo.svg");
  const [logoIconUrl, setLogoIconUrlState] = useState<string>("/images/logo/logo-icon.svg");
  const [logoLightUrl, setLogoLightUrlState] = useState<string>("/images/logo/connors-color.png");
  const [logoDarkUrl, setLogoDarkUrlState] = useState<string>("/images/logo/connors-white.png");
  const [headerBgColor, setHeaderBgColorState] = useState<string>("#ffffff");
  const [headerTextColor, setHeaderTextColorState] = useState<string>("#1d2939");
  const [sidebarBgColor, setSidebarBgColorState] = useState<string>("#ffffff");
  const [sidebarTextColor, setSidebarTextColorState] = useState<string>("#1d2939");

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
    
    if (savedColor) {
      setPrimaryColorState(savedColor);
      updateCSSVariables(savedColor);
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

    // Update CSS variables
    const root = document.documentElement;
    Object.entries(shades).forEach(([shade, value]) => {
      root.style.setProperty(`--color-brand-${shade}`, value);
    });
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
        headerBgColor,
        setHeaderBgColor,
        headerTextColor,
        setHeaderTextColor,
        sidebarBgColor,
        setSidebarBgColor,
        sidebarTextColor,
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
