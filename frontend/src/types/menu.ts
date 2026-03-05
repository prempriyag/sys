export type MenuItem = {
  name: string;
  path?: string;
  icon?: string | React.ReactNode;
  permission?: string; // Single permission check (checkpermission)
  permissions?: string[]; // Multiple permissions check (checkallpermission - show if user has ANY)
  subItems?: MenuItem[];
  /** Paths that also mark this item as active (e.g. batch view under same section) */
  activePaths?: string[];
  badge?: {
    label: string;
    variant?: "new" | "pro" | "default";
  };
};

export type ModuleType = "sir" | "college";

export type MenuConfig = {
  module: ModuleType;
  items: MenuItem[];
};

