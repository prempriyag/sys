import { Link, useLocation } from "react-router";
import { useModule } from "../../context/ModuleContext";
import { useAuth } from "../../context/AuthContext";
import { getMenuByModule } from "../../config/menus";
import { MenuItem } from "../../types/menu";
import { checkPermission, checkAnyPermission } from "../../utils/permissions";
import { useMemo } from "react";

interface SubMenuTabsProps {
  parentMenuName: string; // Name of the parent menu item (e.g., "Transcripts", "Reports")
}

const SubMenuTabs: React.FC<SubMenuTabsProps> = ({ parentMenuName }) => {
  const location = useLocation();
  const { currentModule } = useModule();
  const { user } = useAuth();
  const menuConfig = getMenuByModule(currentModule);

  // Find the parent menu item and get its subItems
  const subMenuItems = useMemo(() => {
    if (!user || !menuConfig.items) return [];

    // Find the parent menu item (only in top-level items)
    const findParentMenuItem = (items: MenuItem[]): MenuItem | null => {
      for (const item of items) {
        // Check if this is the parent item by exact name or contains parentMenuName
        if (item.name === parentMenuName || 
            item.name === `College ${parentMenuName}` ||
            item.name.includes(parentMenuName)) {
          return item;
        }
      }
      return null;
    };

    const parentItem = findParentMenuItem(menuConfig.items);
    if (!parentItem || !parentItem.subItems) return [];

    // Filter subItems based on permissions
    return parentItem.subItems.filter((subItem) => {
      if (!subItem.path) return false; // Only show items with paths
      
      if (subItem.permission) {
        return checkPermission(user, subItem.permission, "VIEW", currentModule);
      }
      
      if (subItem.permissions && subItem.permissions.length > 0) {
        return checkAnyPermission(user, subItem.permissions, "VIEW");
      }

      return true; // Show if no permission check required
    });
  }, [user, menuConfig, parentMenuName, currentModule]);

  // Don't render if no subItems
  if (subMenuItems.length === 0) return null;

  const isActive = (path: string): boolean => {
    if (!path) return false;
    const pathWithoutQuery = path.split("?")[0];
    return (
      location.pathname === pathWithoutQuery ||
      location.pathname.startsWith(pathWithoutQuery + "/")
    );
  };

  return (
    <div className="sticky top-16 z-40 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm lg:hidden">
      <div className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-1">
        {subMenuItems.map((subItem, index) => {
          const active = isActive(subItem.path || "");
          return (
            <Link
              key={index}
              to={subItem.path || "#"}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                active
                  ? "bg-brand-500 text-white shadow-md"
                  : "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {subItem.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SubMenuTabs;
