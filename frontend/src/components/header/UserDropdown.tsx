import { useState, useRef, useEffect, useMemo } from "react";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { Link, useNavigate } from "react-router";
import { useModule } from "../../context/ModuleContext";
import { useAuth } from "../../context/AuthContext";
import { ModuleType } from "../../types/menu";

/**
 * Get initials from a name
 * Examples:
 * - "Digiscript Admin" → "DA"
 * - "Naresh" → "N"
 * - "Mahesh Budella Tailor" → "MB" (first + second word only)
 */
const getInitials = (name: string): string => {
  if (!name) return "U";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  // First letter of first word + first letter of second word
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
};

/**
 * Generate a consistent background color based on the name
 */
const getAvatarColor = (name: string): string => {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-cyan-500",
  ];
  // Simple hash to get consistent color for same name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { currentModule, setCurrentModule } = useModule();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Get initials and color for avatar fallback
  const initials = useMemo(() => getInitials(user?.name || ""), [user?.name]);
  const avatarColor = useMemo(() => getAvatarColor(user?.name || "User"), [user?.name]);
  
  // Reset image error when user changes
  useEffect(() => {
    setImageError(false);
  }, [user?.id]);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  // Close dropdown when clicking outside
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleModuleChange = (module: ModuleType) => {
    closeDropdown();
    // Navigate to the module's dashboard - ModuleContext will update automatically based on URL
    // College is the default module, so use /dashboard instead of /college/dashboard
    // if (module === "college") {
    //   navigate("/dashboard");
    // } else {
      navigate(`/${module}/dashboard`);
    // }
  };

  // Get permissions from user context
  const collegePerm = user?.college_perm === 1;
  const hsPerm = user?.hs_perm === 1;
  const ocrPerm = user?.ocr_perm === 1;
  const userName = user?.name || "User";
  const userEmail = user?.email || "";

  const modules: { value: ModuleType; label: string; perm: boolean }[] = [
    { value: "college", label: "College", perm: collegePerm },
    { value: "school", label: "High School", perm: hsPerm },
    { value: "ocrverify", label: "OCR Portal", perm: ocrPerm },
  ];

  const getProfilePath = () => {
    if (currentModule === "college") {
      return "/profile";
    }
    return `/${currentModule}/profile`;
  };

  const getSettingsPath = () => {
    if (currentModule === "college") {
      return "/settings";
    }
    return `/${currentModule}/settings`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center text-gray-700 dropdown-toggle dark:text-gray-400"
      >
        <span className="mr-3 overflow-hidden rounded-full h-11 w-11 flex-shrink-0">
          {!imageError && user?.id ? (
            <img
              src={
                // Priority: 1. SSO profile image (from Microsoft Graph)
                //           2. Local uploaded profile image
                user?.profile_image 
                  ? `${user.profile_image}?time=${Date.now()}` 
                  : `/assets/userprofile/${user.id}.png?time=${Date.now()}`
              }
              alt={user?.name || "User"}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div 
              className={`w-full h-full flex items-center justify-center text-white font-semibold text-sm ${avatarColor}`}
              title={user?.name || "User"}
            >
              {initials}
            </div>
          )}
        </span>

        <span className="hidden mr-1 font-medium text-theme-sm lg:block">{userName}</span>
        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
            }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        {/* Module Switcher Section */}
        <div className="pb-3 mb-3 border-b border-gray-200 dark:border-gray-800">
          {modules
            .filter((module) => module.perm)
            .map((module) => {
              const isActive = currentModule === module.value;
              return (
                <button
                  key={module.value}
                  onClick={() => handleModuleChange(module.value)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isActive && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 481.607 458.687"
                        fill="currentColor"
                        className="text-brand-500"
                      >
                        <path
                          d="M571.31,54.4,277.85,383.628c-44.711-71.164-94.551-123.48-156.54-130.65-12.305-1.895-16.359,15.4-6.875,20.875,73.309,42.113,111.23,147.83,144.48,228.95,3.59,8.508,14.9,8.129,19.527,2.246l310.54-436.8c7-12.125-7.734-23.781-17.664-13.852Z"
                          transform="translate(-109.198 -50.658)"
                          fillRule="evenodd"
                        />
                      </svg>
                    )}
                    <span style={{ marginLeft: isActive ? "6px" : "27px" }}>
                      {module.label}
                    </span>
                  </div>
                </button>
              );
            })}
        </div>

        {/* User Info Section */}
        <div className="pb-3 mb-3 border-b border-gray-200 dark:border-gray-800">
          <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
            {userName}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {userEmail}
          </span>
        </div>

        {/* Profile and Settings Links */}
        <ul className="flex flex-col gap-1 pb-3 mb-3 border-b border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to={getProfilePath()}
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 3.5C7.30558 3.5 3.5 7.30558 3.5 12C3.5 14.1526 4.3002 16.1184 5.61936 17.616C6.17279 15.3096 8.24852 13.5955 10.7246 13.5955H13.2746C15.7509 13.5955 17.8268 15.31 18.38 17.6167C19.6996 16.119 20.5 14.153 20.5 12C20.5 7.30558 16.6944 3.5 12 3.5ZM17.0246 18.8566V18.8455C17.0246 16.7744 15.3457 15.0955 13.2746 15.0955H10.7246C8.65354 15.0955 6.97461 16.7744 6.97461 18.8455V18.856C8.38223 19.8895 10.1198 20.5 12 20.5C13.8798 20.5 15.6171 19.8898 17.0246 18.8566ZM2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12ZM11.9991 7.25C10.8847 7.25 9.98126 8.15342 9.98126 9.26784C9.98126 10.3823 10.8847 11.2857 11.9991 11.2857C13.1135 11.2857 14.0169 10.3823 14.0169 9.26784C14.0169 8.15342 13.1135 7.25 11.9991 7.25ZM8.48126 9.26784C8.48126 7.32499 10.0563 5.75 11.9991 5.75C13.9419 5.75 15.5169 7.32499 15.5169 9.26784C15.5169 11.2107 13.9419 12.7857 11.9991 12.7857C10.0563 12.7857 8.48126 11.2107 8.48126 9.26784Z"
                  fill=""
                />
              </svg>
              Profile
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to={getSettingsPath()}
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
                  fill=""
                />
              </svg>
              Settings
            </DropdownItem>
          </li>
        </ul>

        {/* Sign Out Link */}
        <button
          onClick={() => {
            closeDropdown();
            logout();
          }}
          className="flex items-center gap-3 w-full px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-300"
        >
          <svg
            className="fill-gray-500 group-hover:fill-gray-700 dark:group-hover:fill-gray-300"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.1007 19.247C14.6865 19.247 14.3507 18.9112 14.3507 18.497L14.3507 14.245H12.8507V18.497C12.8507 19.7396 13.8581 20.747 15.1007 20.747H18.5007C19.7434 20.747 20.7507 19.7396 20.7507 18.497L20.7507 5.49609C20.7507 4.25345 19.7433 3.24609 18.5007 3.24609H15.1007C13.8581 3.24609 12.8507 4.25345 12.8507 5.49609V9.74501L14.3507 9.74501V5.49609C14.3507 5.08188 14.6865 4.74609 15.1007 4.74609L18.5007 4.74609C18.9149 4.74609 19.2507 5.08188 19.2507 5.49609L19.2507 18.497C19.2507 18.9112 18.9149 19.247 18.5007 19.247H15.1007ZM3.25073 11.9984C3.25073 12.2144 3.34204 12.4091 3.48817 12.546L8.09483 17.1556C8.38763 17.4485 8.86251 17.4487 9.15549 17.1559C9.44848 16.8631 9.44863 16.3882 9.15583 16.0952L5.81116 12.7484L16.0007 12.7484C16.4149 12.7484 16.7507 12.4127 16.7507 11.9984C16.7507 11.5842 16.4149 11.2484 16.0007 11.2484L5.81528 11.2484L9.15585 7.90554C9.44864 7.61255 9.44847 7.13767 9.15547 6.84488C8.86248 6.55209 8.3876 6.55226 8.09481 6.84525L3.52309 11.4202C3.35673 11.5577 3.25073 11.7657 3.25073 11.9984Z"
              fill=""
            />
          </svg>
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
