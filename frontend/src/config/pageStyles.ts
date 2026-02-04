/**
 * Centralized page style configuration
 * Modify these values to change styles across all pages
 */

export const pageStyles = {
  // Outer container styles
  container: {
    width: '100%',
    maxWidth: '100%',
    overflowX: 'hidden' as const,
  },
  
  // Content container styles (the main white box)
  contentContainer: {
    // Base classes - modify these to change all pages
    baseClasses: 'rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-gray-900 xl:px-4 xl:py-4',
    baseStyle: {
      backgroundColor: 'transparent',
    },
    
    // Inline styles (if needed)
    inlineStyles: {
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden' as const,
    },
    
    // Optional: min-height for full-height pages
    minHeight: false, // Set to true to add min-h-screen
  },
  
  // Page header styles
  header: {
    titleClasses: 'font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl',
    spacing: 'mb-6',
  },
};



