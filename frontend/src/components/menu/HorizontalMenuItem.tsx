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

  // Check permission for this item
  if (item.permission && !checkPermission(item.permission, user)) {
    return null;
  }

  const isActive = (path?: string) => {
    if (!path) return false;
    const pathWithoutQuery = path.split("?")[0];
    return location.pathname === pathWithoutQuery || location.pathname.startsWith(pathWithoutQuery + "/");
  };

  // Check permission for this item
  if (item.permission && !checkPermission(item.permission, user)) {
    return null;
  }

  const isItemActive = isActive(item.path);
  const hasSubItems = item.subItems && item.subItems.length > 0;

  // Calculate dropdown position
  useEffect(() => {
    if (isSubmenuOpen && buttonRef.current && dropdownRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      dropdownRef.current.style.position = "fixed";
      dropdownRef.current.style.top = `${buttonRect.bottom + 4}px`;
      dropdownRef.current.style.left = `${buttonRect.left}px`;
    }
  }, [isSubmenuOpen]);

  if (!hasSubItems) {
    return (
      <li>
        <Link
          to={item.path || "#"}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
            isItemActive
              ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
              : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          {getIcon(item.icon)}
          <span>{item.name}</span>
        </Link>
      </li>
    );
  }

  return (
    <li className="relative group" style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        onClick={() => onSubmenuToggle(key)}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          isItemActive || isSubmenuOpen
            ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        {getIcon(item.icon)}
        <span>{item.name}</span>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform ${isSubmenuOpen ? "rotate-180" : ""}`}
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

