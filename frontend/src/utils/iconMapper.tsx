import React from "react";
import {
  GridIcon,
  CalenderIcon,
  UserCircleIcon,
  FileIcon,
  ListIcon,
  TableIcon,
  GroupIcon,
  PieChartIcon,
  DownloadIcon,
  EyeIcon,
  TaskIcon,
  TimeIcon,
  DocsIcon,
  BoltIcon,
  PageIcon,
  BoxIcon,
  PencilIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  FolderIcon,
  BoxCubeIcon,
} from "../icons";

// Map icon string names to icon components
export const iconMap: Record<string, React.ComponentType<any>> = {
  dashboard: GridIcon,
  "user-circle": UserCircleIcon,
  "file-text": FileIcon,
  settings: TaskIcon, // Using TaskIcon as settings
  users: GroupIcon,
  "bar-chart": PieChartIcon,
  upload: DownloadIcon,
  eye: EyeIcon,
  database: TaskIcon, // Using TaskIcon as database placeholder
  clock: TimeIcon,
  book: DocsIcon,
  refresh: BoltIcon,
  calendar: CalenderIcon,
  list: ListIcon,
  table: TableIcon,
  page: PageIcon,
  box: BoxIcon,
  pencil: PencilIcon,
  "check-circle": CheckCircleIcon,
  "arrow-right": ArrowRightIcon,
  folder: FolderIcon,
  "box-cube": BoxCubeIcon,
};

export const getIcon = (iconName?: string | React.ReactNode): React.ReactNode => {
  if (!iconName) return null;
  
  if (typeof iconName === "string") {
    const IconComponent = iconMap[iconName];
    return IconComponent ? React.createElement(IconComponent, { className: "w-5 h-5" }) : null;
  }
  
  return iconName;
};

