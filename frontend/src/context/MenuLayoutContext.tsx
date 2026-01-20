import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type MenuLayoutType = "vertical" | "horizontal";

type MenuLayoutContextType = {
  menuLayout: MenuLayoutType;
  setMenuLayout: (layout: MenuLayoutType) => void;
  toggleMenuLayout: () => void;
};

const MenuLayoutContext = createContext<MenuLayoutContextType | undefined>(undefined);

export const useMenuLayout = () => {
  const context = useContext(MenuLayoutContext);
  if (!context) {
    throw new Error("useMenuLayout must be used within a MenuLayoutProvider");
  }
  return context;
};

export const MenuLayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load from localStorage or default to horizontal
  const [menuLayout, setMenuLayoutState] = useState<MenuLayoutType>(() => {
    const saved = localStorage.getItem("menuLayout");
    return (saved === "horizontal" || saved === "vertical" ? saved : "horizontal") as MenuLayoutType;
  });

  // Save to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("menuLayout", menuLayout);
  }, [menuLayout]);

  const setMenuLayout = (layout: MenuLayoutType) => {
    setMenuLayoutState(layout);
  };

  const toggleMenuLayout = () => {
    setMenuLayoutState((prev) => (prev === "vertical" ? "horizontal" : "vertical"));
  };

  return (
    <MenuLayoutContext.Provider value={{ menuLayout, setMenuLayout, toggleMenuLayout }}>
      {children}
    </MenuLayoutContext.Provider>
  );
};



