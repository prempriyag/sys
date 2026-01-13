import { useMenuLayout } from "../../context/MenuLayoutContext";

export default function MenuLayoutToggle() {
  const { menuLayout, toggleMenuLayout } = useMenuLayout();

  return (
    <button
      onClick={toggleMenuLayout}
      className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
      title={`Switch to ${menuLayout === "vertical" ? "horizontal" : "vertical"} menu`}
      aria-label={`Switch to ${menuLayout === "vertical" ? "horizontal" : "vertical"} menu`}
    >
      {menuLayout === "vertical" ? (
        // Horizontal menu icon
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 12H21M3 6H21M3 18H21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Vertical menu icon
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 3V21M6 3V21M18 3V21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

