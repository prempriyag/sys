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
        // {
        //   name: "Extract PDF (Preview)",
        //   path: "/upload/pdf-extract",
        //   icon: "file-text",
        // },
        {
          name: "Bulk Extract PDF (Textract)",
          path: "/upload/bulk-textract-extract",
          icon: "file-text",
        },
        {
          name: "Download from ECI",
          path: "/upload/eci-download",
          icon: "download",
        },
        // {
        //   name: "OCR PDF Detector",
        //   path: "/upload/ocr-pdf-detector",
        //   icon: "file-text",
        // },
        // {
        //   name: "Bulk Electoral Roll",
        //   path: "/upload/bulk-electoral-roll",
        //   icon: "file-text",
        // },
        // {
        //   name: "Extract Batches",
        //   path: "/upload/extract-batches",
        //   icon: "folder",
        // },
      ],
    },
    {
      name: "Booth Analysis",
      icon: "bar-chart",
      subItems: [
        {
          name: "Booth KPIs",
          path: "/booths",
          icon: "bar-chart",
        },
        {
          name: "Risk Heatmap",
          path: "/booths/risk-map",
          icon: "bar-chart",
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
      icon: "sliders",
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
      icon: "user-circle",
    },
  ],
};
