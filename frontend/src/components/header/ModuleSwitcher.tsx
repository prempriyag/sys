import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useModule } from "../../context/ModuleContext";
import { ModuleType } from "../../types/menu";
import { ChevronDownIcon } from "../../icons";

const modules: { value: ModuleType; label: string }[] = [
  { value: "sir", label: "SIR" },
];

const ModuleSwitcher: React.FC = () => {
  const { currentModule, setCurrentModule } = useModule();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModuleLabel = modules.find((m) => m.value === currentModule)?.label || "SIR";

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
    setIsOpen(false);
    navigate(`/${module}/dashboard`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        aria-label="Switch Module"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="hidden sm:inline">{currentModuleLabel}</span>
        <span className="sm:hidden">
          S
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 w-48 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700">
          <div className="py-1">
            {modules.map((module) => (
              <button
                key={module.value}
                onClick={() => handleModuleChange(module.value)}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                  currentModule === module.value
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{module.label}</span>
                  {currentModule === module.value && (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleSwitcher;

