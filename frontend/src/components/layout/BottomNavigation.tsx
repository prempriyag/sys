import { useLocation, Link } from "react-router";
import { useModule } from "../../context/ModuleContext";
import { useAuth } from "../../context/AuthContext";
import { getMenuByModule } from "../../config/menus";
import { MenuItem } from "../../types/menu";
import { getIcon } from "../../utils/iconMapper";
import { checkPermission, checkAnyPermission } from "../../utils/permissions";
import { useMemo } from "react";

interface BottomNavItem {
  name: string;
  path: string;
  icon?: string | React.ReactNode;
  subItems?: MenuItem[];
}

const BottomNavigation: React.FC = () => {
  const location = useLocation();
  const { currentModule } = useModule();
  const { user } = useAuth();
  const menuConfig = getMenuByModule(currentModule);

  // Get specific 5 menu items in order: Transcripts, Articulation, Dashboard, Reports, Uploads
  const bottomNavItems = useMemo(() => {
    if (!user || !menuConfig.items) return [];

    // Define the specific items we want in order
    const targetItemNames = ["Transcripts", "Articulation", "Dashboard", "Reports", "College Uploads"];
    const foundItems: (BottomNavItem | null)[] = [null, null, null, null, null]; // Fixed array for ordering

    // Find each item by name and check permissions
    menuConfig.items.forEach((item) => {
      const targetIndex = targetItemNames.findIndex(name => 
        item.name === name || item.name.includes(name)
      );
      
      if (targetIndex === -1) return; // Not one of our target items

      // Check permissions
      if (item.permission && !checkPermission(user, item.permission, "VIEW", currentModule)) {
        return;
      }

      if (item.permissions && item.permissions.length > 0) {
        if (!checkAnyPermission(user, item.permissions, "VIEW")) {
          return;
        }
      }

      // If item has a direct path, use it
      if (item.path) {
        foundItems[targetIndex] = {
          name: item.name === "College Uploads" ? "Uploads" : item.name,
          path: item.path,
          icon: item.icon,
        };
      } else if (item.subItems && item.subItems.length > 0) {
        // For items with subItems, use the first subItem that has a path
        for (const subItem of item.subItems) {
          if (subItem.path) {
            // Check subItem permission if it has one
            if (subItem.permission && !checkPermission(user, subItem.permission, "VIEW", currentModule)) {
              continue;
            }
            
            foundItems[targetIndex] = {
              name: item.name === "College Uploads" ? "Uploads" : item.name,
              path: subItem.path,
              icon: item.icon,
              subItems: item.subItems, // Store subItems for later use
            } as BottomNavItem & { subItems?: MenuItem[] };
            break;
          }
        }
      }
    });

    // Filter out null values and return
    return foundItems.filter((item): item is BottomNavItem => item !== null);
  }, [user, menuConfig, currentModule]);

  const isActive = (path: string): boolean => {
    if (!path) return false;
    const pathWithoutQuery = path.split("?")[0];
    return (
      location.pathname === pathWithoutQuery ||
      location.pathname.startsWith(pathWithoutQuery + "/")
    );
  };

  // Order items: Transcripts, Articulation, Dashboard, Reports, Uploads (must run before any return - hooks rule)
  const orderedItems = useMemo(() => {
    if (bottomNavItems.length < 2) return [];
    const orderMap: Record<string, number> = {
      "Transcripts": 0,
      "Articulation": 1,
      "Dashboard": 2,
      "Reports": 3,
      "Uploads": 4,
      "College Uploads": 4,
    };
    return [...bottomNavItems].sort((a, b) => {
      const orderA = orderMap[a.name] ?? 999;
      const orderB = orderMap[b.name] ?? 999;
      return orderA - orderB;
    });
  }, [bottomNavItems]);

  // Don't render if we don't have items or less than 2 items
  if (bottomNavItems.length < 2) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-800/50 shadow-2xl">
      {/* Safe area padding for devices with home indicator */}
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16 px-1">
          {orderedItems.map((item, index) => {
            // Dashboard is always at index 2 (center position)
            const isDashboard = item.name === "Dashboard";
            const active = isActive(item.path);
            
            return (
              <Link
                key={`${item.path}-${index}`}
                to={item.path}
                className={`relative flex flex-col items-center justify-center h-full min-w-0 px-1 py-1.5 transition-all duration-200 ease-in-out rounded-lg ${
                  isDashboard ? "flex-[1.2]" : "flex-1"
                } ${
                  active
                    ? "text-brand-500 dark:text-brand-400"
                    : "text-gray-600 dark:text-gray-400"
                } active:scale-95 active:bg-gray-100 dark:active:bg-gray-800`}
              >
                <span className={`mb-0.5 transition-transform duration-200 ${active ? "scale-110" : ""} ${isDashboard ? "text-brand-500" : ""}`}>
                  {getIcon(item.icon) || (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={`text-[10px] font-medium leading-tight max-w-full truncate text-center ${
                    active || isDashboard ? "text-brand-500 dark:text-brand-400 font-semibold" : ""
                  }`}
                  style={{ lineHeight: "1.2" }}
                >
                  {item.name}
                </span>
                {active && (
                  <span className="absolute top-0 left-1/2 transform -translate-x-1/2 w-10 h-0.5 bg-brand-500 rounded-full" />
                )}
                {isDashboard && !active && (
                  <span className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-brand-500/30 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNavigation;
