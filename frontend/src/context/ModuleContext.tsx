import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router";
import { ModuleType } from "../types/menu";

type ModuleContextType = {
  currentModule: ModuleType;
  setCurrentModule: (module: ModuleType) => void;
};

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const useModule = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error("useModule must be used within a ModuleProvider");
  }
  return context;
};

export const ModuleProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const [currentModule, setCurrentModuleState] = useState<ModuleType>("college");

  // Determine module from URL path
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/school")) {
      setCurrentModuleState("school");
    } else if (path.startsWith("/ocrverify")) {
      setCurrentModuleState("ocrverify");
    } else if (path.startsWith("/college") || path === "/" || path === "/dashboard" || path.startsWith("/dashboard/")) {
      setCurrentModuleState("college");
    }
  }, [location.pathname]);

  const setCurrentModule = (module: ModuleType) => {
    setCurrentModuleState(module);
    // Module change will trigger navigation in the component that calls this
  };

  return (
    <ModuleContext.Provider value={{ currentModule, setCurrentModule }}>
      {children}
    </ModuleContext.Provider>
  );
};

