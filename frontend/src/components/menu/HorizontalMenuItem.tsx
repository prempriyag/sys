import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "../../icons";
import { MenuItem } from "../../types/menu";
import { getIcon } from "../../utils/iconMapper";
import { useAuth } from "../../context/AuthContext";
import { checkPermission } from "../../utils/permissions";

interface HorizontalMenuItemProps {
  item: MenuItem;
  index: number;
  openSubmenu: Record<string, boolean>;
  onSubmenuToggle: (key: string) => void;
}

export default function HorizontalMenuItem({
  item,
  index,
  openSubmenu,
  onSubmenuToggle,
}: HorizontalMenuItemProps) {
  // All hooks must be called before any conditional returns
  const location = useLocation();
  const { user } = useAuth();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  
  const key = `${index}`;
  const isSubmenuOpen = openSubmenu[key] || false;
  const hasSubItems = item.subItems && item.subItems.length > 0;
  // Show icon only for items without subItems (Dashboard, User Management) OR items with subItems (for testing)
  const showIconOnly = false;
    //(!hasSubItems);// && (item.name === "Dashboard" || item.name === "User Management"));// ||
    //(hasSubItems && (item.name === "Transcripts" || item.name === "Dashboard" || item.name === "User Management")); // Add item names here to test icon-only with submenus
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLocationRef = useRef<string>(location.pathname);

  const isActive = (path?: string, activePaths?: string[]) => {
    const current = location.pathname.split("?")[0];
    if (path) {
      const pathWithoutQuery = path.split("?")[0];
      if (current === pathWithoutQuery || current.startsWith(pathWithoutQuery + "/")) {
        return true;
      }
    }
    if (activePaths?.length) {
      return activePaths.some((p) => {
        const pClean = p.split("?")[0];
        return current === pClean || current.startsWith(pClean + "/");
      });
    }
    return false;
  };

  const isItemActive = isActive(item.path, item.activePaths);

  // Close submenu when location changes (after navigation)
  useEffect(() => {
    if (prevLocationRef.current !== location.pathname && isSubmenuOpen) {
      onSubmenuToggle(key);
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, isSubmenuOpen, key, onSubmenuToggle]);

  // Handle hover to open submenu - DISABLED
  const handleMouseEnter = () => {
    setIsButtonHovered(true);
    // Hover-triggered dropdown disabled - only allow click
    // if (hasSubItems) {
    //   // Clear any pending close timeout
    //   if (hoverTimeoutRef.current) {
    //     clearTimeout(hoverTimeoutRef.current);
    //     hoverTimeoutRef.current = null;
    //   }
    //   // Open submenu if not already open
    //   if (!isSubmenuOpen) {
    //     onSubmenuToggle(key);
    //   }
    // }
  };

  // Handle mouse leave with delay - DISABLED
  const handleMouseLeave = () => {
    setIsButtonHovered(false);
    // Auto-close on hover-away disabled
    // if (hasSubItems && isSubmenuOpen) {
    //   // Set a timeout to close the submenu
    //   hoverTimeoutRef.current = setTimeout(() => {
    //     onSubmenuToggle(key);
    //   }, 200); // 200ms delay to allow moving to dropdown
    // }
  };

  // Handle mouse enter on dropdown to keep it open - DISABLED
  const handleDropdownMouseEnter = () => {
    setIsButtonHovered(true);
    // Clear any pending close timeout
    // if (hoverTimeoutRef.current) {
    //   clearTimeout(hoverTimeoutRef.current);
    //   hoverTimeoutRef.current = null;
    // }
  };

  // Handle mouse leave on dropdown to close it - DISABLED
  const handleDropdownMouseLeave = () => {
    setIsButtonHovered(false);
    // Auto-close on leave disabled
    // if (isSubmenuOpen) {
    //   hoverTimeoutRef.current = setTimeout(() => {
    //     onSubmenuToggle(key);
    //   }, 200);
    // }
  };

  // Hide tooltip when button is hovered (text expands)
  useEffect(() => {
    if (isButtonHovered && showIconOnly) {
      setShowTooltip(false);
    }
  }, [isButtonHovered, showIconOnly]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Calculate dropdown position - update on scroll and resize
  useEffect(() => {
    if (isSubmenuOpen && buttonRef.current && dropdownRef.current) {
      const updatePosition = () => {
        if (buttonRef.current && dropdownRef.current) {
          const buttonRect = buttonRef.current.getBoundingClientRect();
          dropdownRef.current.style.position = "fixed";
          dropdownRef.current.style.top = `${buttonRect.bottom + 4}px`;
          dropdownRef.current.style.left = `${buttonRect.left}px`;
        }
      };
      
      // Initial position
      updatePosition();
      
      // Update on scroll
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isSubmenuOpen]);

  // Handle click outside to close submenu
  useEffect(() => {
    if (!isSubmenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both button and dropdown
      // For Portaled items, we check the dropdownRef
      const isOutsideButton = buttonRef.current && !buttonRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      
      if (isOutsideButton && isOutsideDropdown) {
        onSubmenuToggle(key);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSubmenuOpen, key, onSubmenuToggle]);

  // Check tooltip position on hover - use portal to escape scroll container
  useEffect(() => {
    if (showIconOnly && iconRef.current) {
      const updateTooltipPosition = () => {
        if (!iconRef.current) return;
        const iconRect = iconRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceAbove = iconRect.top;
        const spaceBelow = viewportHeight - iconRect.bottom;
        const tooltipHeight = 32; // Approximate tooltip height
        
        // Calculate position
        let top: number;
        let placement: "top" | "bottom";
        
        if (spaceBelow >= tooltipHeight + 8 || spaceAbove < tooltipHeight + 8) {
          // Show below
          top = iconRect.bottom + 8;
          placement = "bottom";
        } else {
          // Show above
          top = iconRect.top - tooltipHeight - 8;
          placement = "top";
        }
        
        setTooltipPosition({
          top,
          left: iconRect.left + iconRect.width / 2,
          placement
        });
      };
      
      // Handle both link (no subItems) and button (with subItems) elements
      const linkElement = iconRef.current.closest('a');
      const buttonElement = iconRef.current.closest('button');
      const parentElement = linkElement || buttonElement;
      
      if (parentElement) {
        const handleMouseEnter = () => {
          updateTooltipPosition();
          setShowTooltip(true);
        };
        
        const handleMouseLeave = () => {
          setShowTooltip(false);
        };
        
        parentElement.addEventListener('mouseenter', handleMouseEnter);
        parentElement.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('scroll', updateTooltipPosition, true);
        window.addEventListener('resize', updateTooltipPosition);
        
        return () => {
          parentElement.removeEventListener('mouseenter', handleMouseEnter);
          parentElement.removeEventListener('mouseleave', handleMouseLeave);
          window.removeEventListener('scroll', updateTooltipPosition, true);
          window.removeEventListener('resize', updateTooltipPosition);
        };
      }
    }
  }, [showIconOnly, isButtonHovered]);

  // Check permission for this item (single permission)
  if (item.permission && !checkPermission(user, item.permission, "VIEW")) {
    return null;
  }
  
  // Check permissions array (show if user has ANY of the permissions)
  if (item.permissions && item.permissions.length > 0) {
    const hasAnyPermission = item.permissions.some(perm => checkPermission(user, perm, "VIEW"));
    if (!hasAnyPermission) {
      return null;
    }
  }

  if (!hasSubItems) {
    
    return (
      <li className="flex-shrink-0">
        <Link
          to={item.path || "#"}
          className={`group/link flex items-center ${showIconOnly ? 'justify-center px-3' : 'gap-2 px-4'} py-3 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            isItemActive
              ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
              : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
          title={!showIconOnly ? item.name : undefined}
        >
          <span ref={iconRef} className="relative">
            {getIcon(item.icon)}
          </span>
          {!showIconOnly && <span>{item.name}</span>}
        </Link>
        {showIconOnly && showTooltip && tooltipPosition && createPortal(
          <div
            ref={tooltipRef}
            className="fixed bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-[10001] whitespace-nowrap opacity-100 transition-opacity"
            style={{
              top: `${tooltipPosition!.top}px`,
              left: `${tooltipPosition!.left}px`,
              transform: 'translateX(-50%)',
            }}
          >
            {item.name}
            <span 
              className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                tooltipPosition!.placement === "top"
                  ? "top-full border-t-gray-900"
                  : "bottom-full border-b-gray-900"
              }`}
              style={{
                [tooltipPosition!.placement === "top" ? "top" : "bottom"]: "100%"
              }}
            ></span>
          </div>,
          document.body
        )}
      </li>
    );
  }

  // Determine if text should be shown (always show if not icon-only, or show on hover if icon-only)
  const shouldShowText = !showIconOnly || (showIconOnly && isButtonHovered);

  return (
    <li className="relative group flex-shrink-0" style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        onClick={() => onSubmenuToggle(key)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`flex items-center ${shouldShowText ? 'gap-0 px-2' : 'justify-center px-3'} py-3 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
          isItemActive || isSubmenuOpen
            ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
        title={!shouldShowText ? item.name : undefined}
      >
        <span ref={iconRef} className="relative">
          {getIcon(item.icon)}
        </span>
        {shouldShowText && (
          <>
            <span className="whitespace-nowrap">{item.name}</span>
            {hasSubItems && (
              <ChevronDownIcon
                className={`w-4 h-4 me-1 transition-transform flex-shrink-0 ${isSubmenuOpen ? "rotate-180" : ""}`}
              />
            )}
          </>
        )}
      </button>
      {showIconOnly && showTooltip && !isButtonHovered && !isSubmenuOpen && tooltipPosition && createPortal(
        <div
          ref={tooltipRef}
          className="fixed bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-[10001] whitespace-nowrap opacity-100 transition-opacity"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {item.name}
          <span 
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              tooltipPosition.placement === "top"
                ? "top-full border-t-gray-900"
                : "bottom-full border-b-gray-900"
            }`}
            style={{
              [tooltipPosition.placement === "top" ? "top" : "bottom"]: "100%"
            }}
          ></span>
        </div>,
        document.body
      )}
      {isSubmenuOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            onMouseEnter={handleDropdownMouseEnter}
            onMouseLeave={handleDropdownMouseLeave}
            className="w-56 bg-white rounded-lg shadow-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 py-2 min-w-max"
            style={{ zIndex: 10000, position: "fixed" }}
          >
            {item.subItems?.map((subItem, subIndex) => {
              const subKey = `${key}-${subIndex}`;
              const isSubItemActive = isActive(subItem.path, subItem.activePaths);
              const hasNestedSubItems = subItem.subItems && subItem.subItems.length > 0;

              if (hasNestedSubItems) {
                return (
                  <NestedMenuItem
                    key={subKey}
                    subItem={subItem}
                    subKey={subKey}
                    isSubItemActive={isSubItemActive}
                    openSubmenu={openSubmenu}
                    onSubmenuToggle={onSubmenuToggle}
                    onRootClose={() => onSubmenuToggle(key)}
                  />
                );
              }

              return (
                <Link
                  key={subKey}
                  to={subItem.path || "#"}
                  onClick={() => onSubmenuToggle(key)} // Close main submenu
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    isSubItemActive
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  {subItem.icon && (
                    <span className={`menu-item-icon-size ${
                      isSubItemActive
                        ? "menu-item-icon-active"
                        : "menu-item-icon-inactive"
                    }`}>
                      {getIcon(subItem.icon)}
                    </span>
                  )}
                  {subItem.name}
                </Link>
              );
            })}
          </div>,
          document.body
        )}
    </li>
  );
}

function NestedMenuItem({
  subItem,
  subKey,
  isSubItemActive,
  openSubmenu,
  onSubmenuToggle,
  onRootClose,
}: {
  subItem: MenuItem;
  subKey: string;
  isSubItemActive: boolean;
  openSubmenu: Record<string, boolean>;
  onSubmenuToggle: (key: string) => void;
  onRootClose: () => void;
}) {
  const nestedButtonRef = useRef<HTMLButtonElement>(null);
  const nestedDropdownRef = useRef<HTMLDivElement>(null);
  const isNestedOpen = openSubmenu[subKey] || false;

  useEffect(() => {
    if (isNestedOpen && nestedButtonRef.current && nestedDropdownRef.current) {
      const updatePosition = () => {
        if (nestedButtonRef.current && nestedDropdownRef.current) {
          const buttonRect = nestedButtonRef.current.getBoundingClientRect();
          nestedDropdownRef.current.style.position = "fixed";
          nestedDropdownRef.current.style.top = `${buttonRect.top}px`;
          nestedDropdownRef.current.style.left = `${buttonRect.right + 4}px`;
        }
      };
      
      updatePosition();
      // Update position on scroll/resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isNestedOpen]);

  // Handle click outside for nested menu
  useEffect(() => {
    if (!isNestedOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideButton = nestedButtonRef.current && !nestedButtonRef.current.contains(target);
      const isOutsideDropdown = nestedDropdownRef.current && !nestedDropdownRef.current.contains(target);
      
      if (isOutsideButton && isOutsideDropdown) {
        onSubmenuToggle(subKey);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNestedOpen, subKey, onSubmenuToggle]);

  return (
    <div className="relative group/nested" style={{ position: "relative" }}>
      <button
        ref={nestedButtonRef}
        onClick={() => onSubmenuToggle(subKey)}
        className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
          isSubItemActive
            ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
      >
        <span>{subItem.name}</span>
        <ChevronDownIcon className="w-4 h-4" />
      </button>
      {isNestedOpen &&
        createPortal(
          <div
            ref={nestedDropdownRef}
            className="w-56 bg-white rounded-lg shadow-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 py-2 min-w-max"
            style={{ zIndex: 10001, position: "fixed" }}
          >
            {subItem.subItems?.map((nestedItem, nestedIndex) => {
              const nestedKey = `${subKey}-${nestedIndex}`;
              return (
                <Link
                  key={nestedKey}
                  to={nestedItem.path || "#"}
                  onClick={() => {
                    onSubmenuToggle(subKey); // Close nested submenu
                    onRootClose(); // Close root menu
                  }}
                  className="block px-4 py-2 text-sm transition-colors text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  {nestedItem.name}
                </Link>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

