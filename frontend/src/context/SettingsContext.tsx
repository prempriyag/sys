"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { API_BASE_URL, api } from "../config/api";

interface SettingsContextType {
  systemName: string;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [systemName, setSystemName] = useState<string>("DigiScript"); // Default fallback
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSettings = async () => {
    try {
      const response = await api.get("/api/mastersettings/get");
      if (response.status === 1 && response.data?.system_name) {
        setSystemName(response.data.system_name);
      }
    } catch (error) {
      console.error("Error fetching system settings:", error);
      // Keep default value on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ systemName, isLoading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
