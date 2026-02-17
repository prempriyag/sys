import { MenuConfig } from "../../types/menu";

// SIR Impact Analysis menu configuration
export const sirMenu: MenuConfig = {
  module: "sir" as const,
  items: [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: "dashboard",
    },
    {
      name: "Data Upload",
      icon: "upload",
      subItems: [
        {
          name: "Upload Pre-SIR Roll",
          path: "/upload/pre-sir",
          icon: "upload",
        },
        {
          name: "Upload Post-SIR Roll",
          path: "/upload/post-sir",
          icon: "upload",
        },
        {
          name: "Run Matching",
          path: "/upload/matching",
          icon: "refresh",
        },
        {
          name: "View uploaded data",
          path: "/upload/roll-data",
          icon: "table",
        },
      ],
    },
    {
      name: "Booth Analysis",
      icon: "map",
      subItems: [
        {
          name: "Booth KPIs",
          path: "/booths",
          icon: "bar-chart",
        },
        {
          name: "Risk Heatmap",
          path: "/booths/risk-map",
          icon: "map",
        },
        {
          name: "Booth Details",
          path: "/booths/analysis",
          icon: "table",
        },
      ],
    },
    {
      name: "Field Validation",
      icon: "check-circle",
      subItems: [
        {
          name: "Sampling Plan",
          path: "/validation/sampling",
          icon: "clipboard",
        },
        {
          name: "Validation Results",
          path: "/validation/results",
          icon: "file-text",
        },
      ],
    },
    {
      name: "Reports",
      icon: "file-text",
      subItems: [
        {
          name: "Executive Summary",
          path: "/reports/summary",
          icon: "docs",
        },
        {
          name: "Booth Action Plan",
          path: "/reports/action-plan",
          icon: "task",
        },
        {
          name: "Constituency Report",
          path: "/reports/constituency",
          icon: "page",
        },
      ],
    },
    {
      name: "User Management",
      path: "/users",
      icon: "user-circle",
      // permission: "user_management", // Removed for now - show to all users
    },
    {
      name: "Roles",
      path: "/roles",
      icon: "shield",
      // permission: "role_management", // Removed for now - show to all users
    },
    {
      name: "Permissions",
      path: "/permissions",
      icon: "key",
      // permission: "permission_management", // Removed for now - show to all users
    },
    {
      name: "Master Settings",
      path: "/master-settings",
      icon: "cog",
      // permission: "master_settings", // Removed for now - show to all users
    },
    {
      name: "Settings",
      path: "/settings",
      icon: "settings",
    },
    {
      name: "Profile",
      path: "/profile",
      icon: "user",
    },
  ],
};
