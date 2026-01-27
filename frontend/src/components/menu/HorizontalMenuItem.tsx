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
  const showIconOnly = 
    (!hasSubItems);// && (item.name === "Dashboard" || item.name === "User Management"));// ||
    //(hasSubItems && (item.name === "Transcripts" || item.name === "Dashboard" || item.name === "User Management")); // Add item names here to test icon-only with submenus
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLocationRef = useRef<string>(location.pathname);

  const isActive = (path?: string) => {
    if (!path) return false;
    const pathWithoutQuery = path.split("?")[0];
    return location.pathname === pathWithoutQuery || location.pathname.startsWith(pathWithoutQuery + "/");
  };

  const isItemActive = isActive(item.path);

  // Close submenu when location changes (after navigation)
  useEffect(() => {
    if (prevLocationRef.current !== location.pathname && isSubmenuOpen) {
      onSubmenuToggle(key);
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, isSubmenuOpen, key, onSubmenuToggle]);

  // Handle hover to open submenu
  const handleMouseEnter = () => {
    setIsButtonHovered(true);
    if (hasSubItems) {
      // Clear any pending close timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      // Open submenu if not already open
      if (!isSubmenuOpen) {
        onSubmenuToggle(key);
      }
    }
  };

  // Handle mouse leave with delay to allow moving to dropdown
  const handleMouseLeave = () => {
    setIsButtonHovered(false);
    if (hasSubItems && isSubmenuOpen) {
      // Set a timeout to close the submenu
      hoverTimeoutRef.current = setTimeout(() => {
        onSubmenuToggle(key);
      }, 200); // 200ms delay to allow moving to dropdown
    }
  };

  // Handle mouse enter on dropdown to keep it open
  const handleDropdownMouseEnter = () => {
    setIsButtonHovered(true);
    // Clear any pending close timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // Handle mouse leave on dropdown to close it
  const handleDropdownMouseLeave = () => {
    setIsButtonHovered(false);
    if (isSubmenuOpen) {
      hoverTimeoutRef.current = setTimeout(() => {
        onSubmenuToggle(key);
      }, 200);
    }
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
              const isSubItemActive = isActive(subItem.path);
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
                  />
                );
              }

              return (
                <Link
                  key={subKey}
                  to={subItem.path || "#"}
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
}: {
  subItem: MenuItem;
  subKey: string;
  isSubItemActive: boolean;
  openSubmenu: Record<string, boolean>;
  onSubmenuToggle: (key: string) => void;
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

