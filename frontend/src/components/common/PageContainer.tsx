import { ReactNode } from "react";
import { pageStyles } from "../../config/pageStyles";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  minHeight?: boolean;
}

/**
 * Reusable page container component
 * Uses centralized styles from pageStyles config
 */
export default function PageContainer({
  children,
  className = "",
  style = {},
  minHeight = false,
}: PageContainerProps) {
  const containerClasses = minHeight
    ? `${pageStyles.contentContainer.baseClasses} min-h-screen`
    : pageStyles.contentContainer.baseClasses;

  const mergedStyles = {
    ...pageStyles.contentContainer.inlineStyles,
    ...style,
  };

  return (
    <div className={containerClasses} style={mergedStyles}>
      {children}
    </div>
  );
}

/**
 * Outer page wrapper component
 * Wraps PageMeta, PageBreadcrumb, and PageContainer
 */
interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PageWrapper({ children, className = "", style = {} }: PageWrapperProps) {
  const mergedStyles = {
    ...pageStyles.container,
    ...style,
  };

  return (
    <div className={className} style={mergedStyles}>
      {children}
    </div>
  );
}



