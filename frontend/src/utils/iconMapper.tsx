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
  AlertIcon,
  RefreshIcon,
  GearIcon,
  UploadIcon,
  DatabaseIcon,
  BarChartIcon,
  GaugeIcon,
  CalculatorIcon,
  FlaskIcon,
  LinkIcon,
  ClipboardIcon,
  BotIcon,
} from "../icons";

// Map icon string names to icon components
export const iconMap: Record<string, React.ComponentType<any>> = {
  // Navigation / Layout
  dashboard: GridIcon,

  // User related
  "user-circle": UserCircleIcon,
  users: GroupIcon,

  // Documents / Files
  "file-text": FileIcon,
  page: PageIcon,
  docs: DocsIcon,
  book: DocsIcon,
  folder: FolderIcon,
  clipboard: ClipboardIcon,

  // Settings / Config
  settings: GearIcon,
  "gear": GearIcon,

  // Data / Charts
  "bar-chart": BarChartIcon,
  "pie-chart": PieChartIcon,
  table: TableIcon,
  database: DatabaseIcon,
  gauge: GaugeIcon,

  // Actions
  upload: UploadIcon,
  download: DownloadIcon,
  refresh: RefreshIcon,
  pencil: PencilIcon,
  "check-circle": CheckCircleIcon,
  "arrow-right": ArrowRightIcon,

  // Status / Alerts
  alert: AlertIcon,
  eye: EyeIcon,

  // Time / Calendar
  clock: TimeIcon,
  calendar: CalenderIcon,

  // Objects / Categories
  box: BoxIcon,
  "box-cube": BoxCubeIcon,
  bolt: BoltIcon,
  list: ListIcon,
  link: LinkIcon,
  task: TaskIcon,

  // Domain-specific
  calculator: CalculatorIcon,
  flask: FlaskIcon,
  bot: BotIcon,
};

export const getIcon = (iconName?: string | React.ReactNode): React.ReactNode => {
  if (!iconName) return null;
  
  if (typeof iconName === "string") {
    const IconComponent = iconMap[iconName];
    return IconComponent ? React.createElement(IconComponent, { className: "w-5 h-5" }) : null;
  }
  
  return iconName;
};
