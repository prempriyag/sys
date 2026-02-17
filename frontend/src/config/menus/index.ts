import { MenuConfig } from "../../types/menu";
import { sirMenu } from "./sir";

export { sirMenu } from "./sir";

// Single menu for SIR application (no modules)
export const getMenu = (): MenuConfig => {
  return sirMenu;
};

// Legacy function for compatibility (returns SIR menu)
export const getMenuByModule = (module?: string): MenuConfig => {
  return sirMenu;
};
