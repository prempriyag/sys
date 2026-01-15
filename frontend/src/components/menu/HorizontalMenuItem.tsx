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
  const location = useLocation();
  const { user } = useAuth();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const key = `${index}`;
  const isSubmenuOpen = openSubmenu[key] || false;

  const isActive = (path?: string) => {
    if (!path) return false;
    const pathWithoutQuery = path.split("?")[0];
    return location.pathname === pathWithoutQuery || location.pathname.startsWith(pathWithoutQuery + "/");
  };

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

  const isItemActive = isActive(item.path);
  const hasSubItems = item.subItems && item.subItems.length > 0;

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

  if (!hasSubItems) {
    // Show icon only for Dashboard and User Management
    const showIconOnly = item.name === "Dashboard" || item.name === "User Management";
    const tooltipRef = useRef<HTMLDivElement>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
    
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
        
        const linkElement = iconRef.current.closest('a');
        if (linkElement) {
          const handleMouseEnter = () => {
            updateTooltipPosition();
            setShowTooltip(true);
          };
          
          const handleMouseLeave = () => {
            setShowTooltip(false);
          };
          
          linkElement.addEventListener('mouseenter', handleMouseEnter);
          linkElement.addEventListener('mouseleave', handleMouseLeave);
          window.addEventListener('scroll', updateTooltipPosition, true);
          window.addEventListener('resize', updateTooltipPosition);
          
          return () => {
            linkElement.removeEventListener('mouseenter', handleMouseEnter);
            linkElement.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('scroll', updateTooltipPosition, true);
            window.removeEventListener('resize', updateTooltipPosition);
          };
        }
      }
    }, [showIconOnly]);
    
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

  return (
    <li className="relative group flex-shrink-0" style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        onClick={() => onSubmenuToggle(key)}
        className={`flex items-center gap-0 px-2 py-3 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
          isItemActive || isSubmenuOpen
            ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        {getIcon(item.icon)}
        <span className="whitespace-nowrap">{item.name}</span>
        <ChevronDownIcon
          className={`w-4 h-4 me-1 transition-transform flex-shrink-0 ${isSubmenuOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isSubmenuOpen &&
        createPortal(
          <div
            ref={dropdownRef}
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
                  className={`block px-4 py-2 text-sm transition-colors ${
                    isSubItemActive
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
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

