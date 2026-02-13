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
  // SIR application - single module, no switching needed
  const [currentModule] = useState<ModuleType>("sir");

  const setCurrentModule = (module: ModuleType) => {
    // No-op for SIR application (single module)
  };

  return (
    <ModuleContext.Provider value={{ currentModule, setCurrentModule }}>
      {children}
    </ModuleContext.Provider>
  );
};

