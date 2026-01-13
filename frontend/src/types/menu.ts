export type MenuItem = {
  name: string;
  path?: string;
  icon?: string | React.ReactNode;
  permission?: string; // Single permission check (checkpermission)
  permissions?: string[]; // Multiple permissions check (checkallpermission - show if user has ANY)
  subItems?: MenuItem[];
  badge?: {
    label: string;
    variant?: "new" | "pro" | "default";
  };
};

export type ModuleType = "college" | "school" | "ocrverify";

export type MenuConfig = {
  module: ModuleType;
  items: MenuItem[];
};

