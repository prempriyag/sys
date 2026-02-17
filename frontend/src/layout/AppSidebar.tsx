import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { useModule } from "../context/ModuleContext";
import { useMenuLayout } from "../context/MenuLayoutContext";
import { useAuth } from "../context/AuthContext";
import { useThemeColor } from "../context/ThemeColorContext";
import { getMenu } from "../config/menus";
import { getIcon } from "../utils/iconMapper";
import { checkPermission, checkAnyPermission } from "../utils/permissions";
import { MenuItem } from "../types/menu";
import { HorizontaLDots } from "../icons";
import HorizontalMenuItem from "../components/menu/HorizontalMenuItem";
import SidebarWidget from "./SidebarWidget";

const AppSidebar = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { currentModule } = useModule();
  const { menuLayout } = useMenuLayout();
  const { user } = useAuth();
  const { logoIconUrl, logoLightUrl, logoDarkUrl, sidebarBgColor, sidebarTextColor } = useThemeColor();
  const location = useLocation();
  const [openSubmenu, setOpenSubmenu] = useState<Record<string, boolean>>({});
  const [subMenuHeights, setSubMenuHeights] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Get menu config for SIR application
  const menuConfig = getMenu();
  const menuConfigItems = menuConfig?.items || [];

  // Filter menu items based on permissions
  const filteredMenuConfigItems = menuConfigItems.filter((item) => {
    // If item has single permission, check it
    if (item.permission) {
      return checkPermission(user, item.permission, "VIEW");
    }
    // If item has multiple permissions (checkallpermission), check if user has any
    if (item.permissions && item.permissions.length > 0) {
      return checkAnyPermission(user, item.permissions, "VIEW");
    }
    // If no permission specified, show item
    return true;
  });

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

  const handleSubmenuToggle = (key: string) => {
    setOpenSubmenu((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    // Update submenu heights when they open/close
    Object.keys(openSubmenu).forEach((key) => {
      if (openSubmenu[key] && subMenuRefs.current[key]) {
        setSubMenuHeights((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    });
  }, [openSubmenu]);

  const renderMenuItem = (item: MenuItem, index: number, parentKey?: string): React.ReactElement | null => {
    // Check if item has single permission (checkpermission equivalent)
    if (
      item.permission &&
      !checkPermission(user, item.permission, "VIEW")
    ) {
      return null; // Hide if user doesn't have permission
    }

    // Check if item has multiple permissions (checkallpermission equivalent)
    if (item.permissions && item.permissions.length > 0) {
      if (!checkAnyPermission(user, item.permissions, "VIEW")) {
        return null; // Hide if user doesn't have any of the permissions
      }
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
              <span
                className={`ml-auto w-4 h-4 transition-all duration-200 ${
                  isSubmenuOpen
                    ? "rotate-180 text-brand-500 dark:text-brand-400"
                    : "text-gray-400 group-hover:text-brand-500 dark:text-gray-500 dark:group-hover:text-brand-400"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </span>
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
                  // Check sub-item permissions
                  if (
                    subItem.permission &&
                    !checkPermission(user, subItem.permission, "VIEW")
                  ) {
                    return null;
                  }
                  if (subItem.permissions && subItem.permissions.length > 0) {
                    if (!checkAnyPermission(user, subItem.permissions, "VIEW")) {
                      return null;
                    }
                  }

                  if (subItem.subItems && subItem.subItems.length > 0) {
                    // For nested submenus, renderMenuItem already returns <li>, so don't wrap it
                    return renderMenuItem(subItem, subIndex, key);
                  }
                  return (
                    <li key={`${key}-sub-${subIndex}`}>
                      <Link
                        to={subItem.path || "#"}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path, subItem.activePaths)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        } cursor-pointer ${
                          !isExpanded && !isHovered
                            ? "lg:justify-center"
                            : "lg:justify-start"
                        }`}
                      >
                        {subItem.icon && (
                          <span
                            className={`menu-item-icon-size group-hover:scale-110 ${
                              isActive(subItem.path, subItem.activePaths)
                                ? "menu-item-icon-active"
                                : "menu-item-icon-inactive"
                            }`}
                          >
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
        <Link to="/dashboard">
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
