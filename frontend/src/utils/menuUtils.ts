import { MenuItem } from "../types/menu";

/**
 * Recursively extract all paths from menu items
 */
export const extractMenuPaths = (items: MenuItem[]): Array<{ path: string; name: string }> => {
  const paths: Array<{ path: string; name: string }> = [];
  
  const traverse = (menuItems: MenuItem[]) => {
    menuItems.forEach((item) => {
      if (item.path) {
        paths.push({ path: item.path, name: item.name });
      }
      if (item.subItems) {
        traverse(item.subItems);
      }
    });
  };
  
  traverse(items);
  return paths;
};
