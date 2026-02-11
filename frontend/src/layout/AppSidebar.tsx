import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { ChevronDownIcon, HorizontaLDots } from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { useModule } from "../context/ModuleContext";
import { useMenuLayout } from "../context/MenuLayoutContext";
import { useAuth } from "../context/AuthContext";
import { useThemeColor } from "../context/ThemeColorContext";
import { getMenuByModule } from "../config/menus";
import { MenuItem } from "../types/menu";
import { getIcon } from "../utils/iconMapper";
import { checkPermission, checkAnyPermission } from "../utils/permissions";
import SidebarWidget from "./SidebarWidget";
import HorizontalMenuItem from "../components/menu/HorizontalMenuItem";

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { currentModule } = useModule();
  const { menuLayout } = useMenuLayout();
  const { user } = useAuth();
  const { logoIconUrl, logoLightUrl, logoDarkUrl, sidebarBgColor, sidebarTextColor } = useThemeColor();
  const location = useLocation();
  const menuConfig = getMenuByModule(currentModule);

  const [openSubmenu, setOpenSubmenu] = useState<Record<string, boolean>>({});
  const [subMenuHeights, setSubMenuHeights] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter menu items based on permissions
  // Similar to how PHP sidebar filters menu items using checkpermission and checkallpermission
  const filterMenuItems = useCallback(
    (items: MenuItem[]): MenuItem[] => {
      if (!user) return []; // If no user, no permissions, so no menu items

      return items.filter((item) => {
        // If item has NO permission requirement, show it (like Dashboard and User Manual)
        if (
          !item.permission &&
          (!item.permissions || item.permissions.length === 0)
        ) {
          return true; // Show items without permission requirements
        }

        // If item has permissions array (checkallpermission equivalent - show if user has ANY)
        if (item.permissions && item.permissions.length > 0) {
          const hasAny = checkAnyPermission(user, item.permissions, "VIEW");
          if (!hasAny) {
            return false; // Hide item if user doesn't have any of the permissions
          }
        }

        // If item has single permission (checkpermission equivalent)
        if (item.permission) {
          const hasPerm = checkPermission(user, item.permission, "VIEW");
          if (!hasPerm) {
            return false; // Hide item if user doesn't have permission
          }
        }

        // If item has subItems, filter them recursively
        if (item.subItems && item.subItems.length > 0) {
          const filteredSubItems = filterMenuItems(item.subItems);
          // Keep parent item only if it has at least one visible subItem
          if (filteredSubItems.length === 0) {
            return false;
          }
          item.subItems = filteredSubItems;
          return true;
        }

        return true; // Keep item if no permission or permission granted
      });
    },
    [user]
  );

  // Filter menu items based on permissions (similar to PHP sidebar filtering)
  const filteredMenuConfigItems = useMemo(
    () => filterMenuItems(menuConfig.items),
    [filterMenuItems, menuConfig.items]
  );

  const isActive = useCallback(
    (path?: string, activePaths?: string[]) => {
      const current = location.pathname.split("?")[0];
      // Exact match on the item's own path (no prefix matching to avoid
      // /college/transcripts lighting up when on /college/transcripts/add)
      if (path) {
        const pathWithoutQuery = path.split("?")[0];
        if (current === pathWithoutQuery) {
          return true;
        }
      }
      // activePaths supports prefix matching (opt-in) for items that need it
      if (activePaths?.length) {
        return activePaths.some((p) => {
          const pClean = p.split("?")[0];
          return current === pClean || current.startsWith(pClean + "/");
        });
      }
      return false;
    },
    [location.pathname]
  );

  // Initialize open submenus based on active route
  useEffect(() => {
    // Reset all submenus first, then only open the ones containing active routes
    if (menuLayout === "horizontal") {
      setOpenSubmenu({});
      return;
    }
    const newOpenSubmenu: Record<string, boolean> = {};
    
    const checkActiveMenu = (
      items: MenuItem[],
      parentKey: string = ""
    ): boolean => {
      let hasAnyActive = false;
      items.forEach((item, index) => {
        const key = parentKey ? `${parentKey}-${index}` : `${index}`;

        if (item.subItems) {
          // Check if any subitem is active (including nested subitems)
          let hasActiveSubItem = false;
          
          item.subItems.forEach((subItem, subIndex) => {
            if (subItem.subItems && subItem.subItems.length > 0) {
              // Recursively check nested submenus
              const nestedKey = `${key}-${subIndex}`;
              const hasNestedActive = checkActiveMenu([subItem], key);
              if (hasNestedActive) {
                newOpenSubmenu[nestedKey] = true;
                hasActiveSubItem = true;
              }
            } else if (isActive(subItem.path, subItem.activePaths)) {
              hasActiveSubItem = true;
            }
          });

          if (hasActiveSubItem) {
            newOpenSubmenu[key] = true;
            hasAnyActive = true;
          }
        }
      });
      return hasAnyActive;
    };

    checkActiveMenu(filteredMenuConfigItems);
    setOpenSubmenu(newOpenSubmenu);
  }, [location.pathname, filteredMenuConfigItems, isActive]);

  useEffect(() => {
    Object.keys(openSubmenu).forEach((key) => {
      if (openSubmenu[key] && subMenuRefs.current[key]) {
        setSubMenuHeights((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    });
  }, [openSubmenu, filteredMenuConfigItems]);

  const handleSubmenuToggle = (key: string) => {
    setOpenSubmenu((prev) => {
      const isCurrentlyOpen = prev[key];
      // If opening this submenu
      if (!isCurrentlyOpen) {
        const newState: Record<string, boolean> = { [key]: true };
        // Keep parent submenus open (check if key contains parent keys)
        Object.keys(prev).forEach((prevKey) => {
          // If prevKey is a parent of key (e.g., "3" is parent of "3-0"), keep it open
          if (key.startsWith(prevKey + "-")) {
            newState[prevKey] = true;
          }
        });
        // Close sibling submenus (same level, different parent)
        // For example, if opening "3-0", close "3-1", "3-2", etc. but keep "3" open
        const keyParts = key.split("-");
        if (keyParts.length > 1) {
          // This is a nested submenu
          const parentKey = keyParts.slice(0, -1).join("-");
          Object.keys(prev).forEach((prevKey) => {
            // Close siblings (same parent, different index)
            if (prevKey.startsWith(parentKey + "-") && prevKey !== key) {
              // Don't add to newState, effectively closing it
            } else if (prevKey === parentKey) {
              // Keep parent open
              newState[prevKey] = true;
            }
          });
        } else {
          // Top-level submenu - close all other top-level submenus
          Object.keys(prev).forEach((prevKey) => {
            if (!prevKey.includes("-") && prevKey !== key) {
              // Don't add to newState, effectively closing it
            }
          });
        }
        return newState;
      }
      // If closing, close this one and all its children
      const newState = { ...prev };
      delete newState[key];
      // Also close all child submenus
      Object.keys(newState).forEach((prevKey) => {
        if (prevKey.startsWith(key + "-")) {
          delete newState[prevKey];
        }
      });
      return newState;
    });
  };

  const renderMenuItem = (
    item: MenuItem,
    index: number,
    parentKey: string = ""
  ): React.ReactNode => {
    // Permission check for individual menu items
    if (!user) return null; // No user, no permissions

    // Check if item has permissions array (checkallpermission equivalent)
    if (item.permissions && item.permissions.length > 0) {
      if (!checkAnyPermission(user, item.permissions, "VIEW")) {
        return null; // Hide if user doesn't have any of the permissions
      }
    }

    // Check if item has single permission (checkpermission equivalent)
    if (
      item.permission &&
      !checkPermission(user, item.permission, "VIEW", currentModule)
    ) {
      return null; // Hide if user doesn't have permission
    }

    const key = parentKey ? `${parentKey}-${index}` : `${index}`;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isItemActive = isActive(item.path, item.activePaths);
    const isSubmenuOpen = openSubmenu[key] || false;

    if (hasSubItems) {
      return (
        <li key={key}>
          <button
            onClick={() => handleSubmenuToggle(key)}
            className={`menu-item group ${
              isSubmenuOpen ? "menu-item-active" : "menu-item-inactive"
            } cursor-pointer ${
              !isExpanded && !isHovered
                ? "lg:justify-center"
                : "lg:justify-start"
            }`}
          >
            <span
              className={`menu-item-icon-size group-hover:scale-110 ${
                isSubmenuOpen
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
              }`}
            >
              {getIcon(item.icon)}
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className="menu-item-text">{item.name}</span>
            )}
            {(isExpanded || isHovered || isMobileOpen) && (
              <ChevronDownIcon
                className={`ml-auto w-4 h-4 transition-all duration-200 ${
                  isSubmenuOpen
                    ? "rotate-180 text-brand-500 dark:text-brand-400"
                    : "text-gray-400 group-hover:text-brand-500 dark:text-gray-500 dark:group-hover:text-brand-400"
                }`}
              />
            )}
          </button>
          {(isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[key] = el;
              }}
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{
                height: isSubmenuOpen ? `${subMenuHeights[key] || 0}px` : "0px",
                opacity: isSubmenuOpen ? 1 : 0,
              }}
            >
              <ul className="mt-2 space-y-0.5 ml-9">
                {item.subItems?.map((subItem, subIndex) => {
                  if (subItem.subItems && subItem.subItems.length > 0) {
                    // For nested submenus, renderMenuItem already returns <li>, so don't wrap it
                    return renderMenuItem(subItem, subIndex, key);
                  }
                  return (
                    <li key={`${key}-sub-${subIndex}`}>
                      <Link
                        to={subItem.path || "#"}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        } cursor-pointer ${
              !isExpanded && !isHovered
                ? "lg:justify-center"
                : "lg:justify-start"
            }`}
                      >
                        {subItem.icon && (
                          <span className={`menu-item-icon-size group-hover:scale-110 ${
                            isActive(subItem.path, subItem.activePaths)
                              ? "menu-item-icon-active"
                              : "menu-item-icon-inactive"
                          }`}>
                            {getIcon(subItem.icon)}
                          </span>
                        )}
                        {subItem.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </li>
      );
    }

    return (
      <li key={key}>
        {item.path ? (
          <Link
            to={item.path}
            className={`menu-item group ${
              isItemActive ? "menu-item-active" : "menu-item-inactive"
            } cursor-pointer ${
              !isExpanded && !isHovered
                ? "lg:justify-center"
                : "lg:justify-start"
            }`}
          >
            <span
              className={`menu-item-icon-size group-hover:scale-110 ${
                isItemActive
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
              }`}
            >
              {getIcon(item.icon)}
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className="menu-item-text">{item.name}</span>
            )}
          </Link>
        ) : (
          <div
            className={`menu-item group ${
              isItemActive ? "menu-item-active" : "menu-item-inactive"
            }`}
          >
            <span
              className={`menu-item-icon-size group-hover:scale-110 ${
                isItemActive
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
              }`}
            >
              {getIcon(item.icon)}
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className="menu-item-text">{item.name}</span>
            )}
          </div>
        )}
      </li>
    );
  };

  // Horizontal menu layout
  if (menuLayout === "horizontal") {
    return (
      <nav
        className="w-full border-b border-brand-200/50 dark:border-gray-700/80 shadow-sm"
        style={{ 
          position: "relative", 
          zIndex: 100, 
          overflow: "visible",
          backgroundColor: sidebarBgColor,
          color: sidebarTextColor,
        }}
      >
        <div
          className="px-4"
          style={{ overflow: "visible", position: "relative" }}
        >
          <ul
            className="flex items-center gap-1 overflow-x-auto overflow-y-visible"
            style={{ position: "relative", scrollbarWidth: "thin" }}
          >
            {filteredMenuConfigItems.map((item, index) => (
              <HorizontalMenuItem
                key={index}
                item={item}
                index={index}
                openSubmenu={openSubmenu}
                onSubmenuToggle={handleSubmenuToggle}
              />
            ))}
          </ul>
        </div>
      </nav>
    );
  }

  // Vertical menu layout (default)
  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-2 left-0 h-screen transition-all duration-300 ease-in-out z-50 border-r border-brand-200/50 dark:border-gray-700/80 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      style={{
        backgroundColor: sidebarBgColor,
        color: sidebarTextColor,
      }}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-4 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-center"
        }`}
      >
        <Link
          to={`/${currentModule}/dashboard`}
        >
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark:hidden object-contain"
                src={logoLightUrl}
                alt="Logo"
                width={220}
                height={40}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/logo/connors-color.png";
                }}
              />
              <img
                className="hidden dark:block object-contain"
                src={logoDarkUrl}
                alt="Logo"
                width={220}
                height={40}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/logo/connors-white.png";
                }}
              />
            </>
          ) : (
            <img
              src={logoIconUrl}
              alt="Logo"
              width={32}
              height={32}
              className="object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/logo/logo-icon.svg";
              }}
            />
          )}
        </Link>
      </div>
      {/* Divider between logo and menu */}
      <div className="mx-2 border-t border-brand-200/40 dark:border-gray-700/60" />
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar pt-2">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-3 text-[11px] uppercase flex leading-[20px] font-semibold tracking-wider text-brand-400 dark:text-brand-500/60 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start px-3"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {filteredMenuConfigItems
                  .map((item, index) => renderMenuItem(item, index))
                  .filter((item) => item !== null)}
              </ul>
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
