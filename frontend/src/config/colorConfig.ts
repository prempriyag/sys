/**
 * Centralized color configuration for the application
 * Update theme colors here and they'll apply globally
 */

export type ColorConfigKey = 'blue' | 'green' | 'red' | 'purple' | 'orange';

export interface ButtonConfig {
  primary: string;
  secondary: string;
  outline: string;
  ghost: string;
  danger: string;
  success: string;
}

export interface ColorConfig {
  border: string;
  bg: string;
  text: string;
  lightText: string;
  darkText: string;
  hover: string;
  shadow: string;
  badge: string;
  icon: string;
  gradientText: string;
  stroke: string;
  chartColor: string;
  orbGradient1: string;
  orbGradient2: string;
  button: ButtonConfig;
}

export const colorThemes: Record<ColorConfigKey, ColorConfig> = {
  blue: {
    border: 'border-blue-200 dark:border-blue-700/40',
    bg: 'bg-gradient-to-br from-blue-50 via-blue-100/90 to-indigo-100/80 dark:from-blue-900/30 dark:via-blue-800/30 dark:to-indigo-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    lightText: 'text-blue-600/90 dark:text-blue-300',
    darkText: 'text-blue-800 dark:text-blue-200',
    hover: 'hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-blue-500/20',
    shadow: 'shadow-blue-500/40 group-hover:shadow-blue-500/60',
    badge: 'bg-blue-500/15 text-blue-800 border border-blue-400/30 dark:bg-blue-400/20 dark:text-blue-200 dark:border-blue-400/40 shadow-blue-500/15',
    icon: 'bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 text-white shadow-blue-500/40 group-hover:shadow-blue-500/60',
    gradientText: 'from-blue-700 via-indigo-700 to-blue-800 dark:from-blue-200 dark:via-indigo-200 dark:to-blue-100',
    stroke: '#3C50E0',
    chartColor: '#3C50E0',
    orbGradient1: 'bg-gradient-to-br from-blue-300 via-indigo-400 to-blue-500',
    orbGradient2: 'bg-gradient-to-tr from-indigo-300 via-blue-400 to-indigo-500',
    button: {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500',
      secondary: 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-300',
      outline: 'border border-blue-300 hover:bg-blue-50 text-blue-700 dark:border-blue-600 dark:hover:bg-blue-900/20 dark:text-blue-300',
      ghost: 'hover:bg-blue-100 text-blue-700 dark:hover:bg-blue-900/30 dark:text-blue-300',
      danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-500',
    },
  },
  green: {
    border: 'border-green-200 dark:border-green-700/40',
    bg: 'bg-gradient-to-br from-green-50 via-green-100/90 to-emerald-100/80 dark:from-green-900/30 dark:via-green-800/30 dark:to-emerald-900/30',
    text: 'text-green-700 dark:text-green-300',
    lightText: 'text-green-600/90 dark:text-green-300',
    darkText: 'text-green-800 dark:text-green-200',
    hover: 'hover:border-green-300 dark:hover:border-green-600 hover:shadow-green-500/20',
    shadow: 'shadow-green-500/40 group-hover:shadow-green-500/60',
    badge: 'bg-green-500/15 text-green-800 border border-green-400/30 dark:bg-green-400/20 dark:text-green-200 dark:border-green-400/40 shadow-green-500/15',
    icon: 'bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 text-white shadow-green-500/40 group-hover:shadow-green-500/60',
    gradientText: 'from-green-700 via-emerald-700 to-green-800 dark:from-green-200 dark:via-emerald-200 dark:to-green-100',
    stroke: '#10B981',
    chartColor: '#10B981',
    orbGradient1: 'bg-gradient-to-br from-green-300 via-emerald-400 to-green-500',
    orbGradient2: 'bg-gradient-to-tr from-teal-300 via-green-400 to-teal-500',
    button: {
      primary: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-500',
      secondary: 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/40 dark:hover:bg-green-900/60 dark:text-green-300',
      outline: 'border border-green-300 hover:bg-green-50 text-green-700 dark:border-green-600 dark:hover:bg-green-900/20 dark:text-green-300',
      ghost: 'hover:bg-green-100 text-green-700 dark:hover:bg-green-900/30 dark:text-green-300',
      danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-500',
    },
  },
  red: {
    border: 'border-red-200 dark:border-red-700/40',
    bg: 'bg-gradient-to-br from-red-50 via-red-100/90 to-rose-100/80 dark:from-red-900/30 dark:via-red-800/30 dark:to-rose-900/30',
    text: 'text-red-700 dark:text-red-300',
    lightText: 'text-red-600/90 dark:text-red-300',
    darkText: 'text-red-800 dark:text-red-200',
    hover: 'hover:border-red-300 dark:hover:border-red-600 hover:shadow-red-500/20',
    shadow: 'shadow-red-500/40 group-hover:shadow-red-500/60',
    badge: 'bg-red-500/15 text-red-800 border border-red-400/30 dark:bg-red-400/20 dark:text-red-200 dark:border-red-400/40 shadow-red-500/15',
    icon: 'bg-gradient-to-br from-red-500 via-rose-500 to-red-600 text-white shadow-red-500/40 group-hover:shadow-red-500/60',
    gradientText: 'from-red-700 via-rose-700 to-red-800 dark:from-red-200 dark:via-rose-200 dark:to-red-100',
    stroke: '#EF4444',
    chartColor: '#EF4444',
    orbGradient1: 'bg-gradient-to-br from-red-300 via-rose-400 to-red-500',
    orbGradient2: 'bg-gradient-to-tr from-pink-300 via-red-400 to-pink-500',
    button: {
      primary: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500',
      secondary: 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-300',
      outline: 'border border-red-300 hover:bg-red-50 text-red-700 dark:border-red-600 dark:hover:bg-red-900/20 dark:text-red-300',
      ghost: 'hover:bg-red-100 text-red-700 dark:hover:bg-red-900/30 dark:text-red-300',
      danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-500',
    },
  },
  purple: {
    border: 'border-purple-200 dark:border-purple-700/40',
    bg: 'bg-gradient-to-br from-purple-50 via-purple-100/90 to-fuchsia-100/80 dark:from-purple-900/30 dark:via-purple-800/30 dark:to-fuchsia-900/30',
    text: 'text-purple-700 dark:text-purple-300',
    lightText: 'text-purple-600/90 dark:text-purple-300',
    darkText: 'text-purple-800 dark:text-purple-200',
    hover: 'hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-purple-500/20',
    shadow: 'shadow-purple-500/40 group-hover:shadow-purple-500/60',
    badge: 'bg-purple-500/15 text-purple-800 border border-purple-400/30 dark:bg-purple-400/20 dark:text-purple-200 dark:border-purple-400/40 shadow-purple-500/15',
    icon: 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-purple-600 text-white shadow-purple-500/40 group-hover:shadow-purple-500/60',
    gradientText: 'from-purple-700 via-fuchsia-700 to-purple-800 dark:from-purple-200 dark:via-fuchsia-200 dark:to-purple-100',
    stroke: '#7a5af8',
    chartColor: '#7a5af8',
    orbGradient1: 'bg-gradient-to-br from-purple-300 via-fuchsia-400 to-purple-500',
    orbGradient2: 'bg-gradient-to-tr from-fuchsia-300 via-purple-400 to-fuchsia-500',
    button: {
      primary: 'bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-600 dark:hover:bg-purple-500',
      secondary: 'bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 dark:text-purple-300',
      outline: 'border border-purple-300 hover:bg-purple-50 text-purple-700 dark:border-purple-600 dark:hover:bg-purple-900/20 dark:text-purple-300',
      ghost: 'hover:bg-purple-100 text-purple-700 dark:hover:bg-purple-900/30 dark:text-purple-300',
      danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-500',
    },
  },
  orange: {
    border: 'border-orange-200 dark:border-orange-700/40',
    bg: 'bg-gradient-to-br from-orange-50 via-orange-100/90 to-amber-100/80 dark:from-orange-900/30 dark:via-orange-800/30 dark:to-amber-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    lightText: 'text-orange-600/90 dark:text-orange-300',
    darkText: 'text-orange-800 dark:text-orange-200',
    hover: 'hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-orange-500/20',
    shadow: 'shadow-orange-500/40 group-hover:shadow-orange-500/60',
    badge: 'bg-orange-500/15 text-orange-800 border border-orange-400/30 dark:bg-orange-400/20 dark:text-orange-200 dark:border-orange-400/40 shadow-orange-500/15',
    icon: 'bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white shadow-orange-500/40 group-hover:shadow-orange-500/60',
    gradientText: 'from-orange-700 via-amber-700 to-orange-800 dark:from-orange-200 dark:via-amber-200 dark:to-orange-100',
    stroke: '#e57124',
    chartColor: '#e57124',
    orbGradient1: 'bg-gradient-to-br from-orange-300 via-amber-400 to-orange-500',
    orbGradient2: 'bg-gradient-to-tr from-amber-300 via-orange-400 to-amber-500',
    button: {
      primary: 'bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-600 dark:hover:bg-orange-500',
      secondary: 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/40 dark:hover:bg-orange-900/60 dark:text-orange-300',
      outline: 'border border-orange-300 hover:bg-orange-50 text-orange-700 dark:border-orange-600 dark:hover:bg-orange-900/20 dark:text-orange-300',
      ghost: 'hover:bg-orange-100 text-orange-700 dark:hover:bg-orange-900/30 dark:text-orange-300',
      danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-500',
    },
  },
};

export function getColorConfig(colorClass: ColorConfigKey): ColorConfig {
  return colorThemes[colorClass];
}

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
