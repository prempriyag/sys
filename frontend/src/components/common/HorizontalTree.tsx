import React, { useState } from 'react';

interface TreeNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  children?: TreeNode[];
  onClick?: () => void;
  isExpanded?: boolean;
}

interface HorizontalTreeProps {
  rootNode: TreeNode;
  headerTitle?: string;
  className?: string;
  onHeaderToggle?: (isExpanded: boolean) => void;
}

export default function HorizontalTree({ 
  rootNode, 
  headerTitle,
  className = '',
  onHeaderToggle
}: HorizontalTreeProps) {
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);

  const handleHeaderToggle = () => {
    const newState = !isHeaderExpanded;
    setIsHeaderExpanded(newState);
    onHeaderToggle?.(newState);
  };

  const FolderIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  );

  const DocumentIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );

  return (
    <div className={`horizontal-tree-wrapper ${className}`}>
      <style>{`
        .horizontal-tree-wrapper {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow-x: auto;
          position: relative;
          padding-bottom: 20px;
        }

        .dark .horizontal-tree-wrapper {
          background: #1f2937;
        }

        .tree-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          cursor: pointer;
          transition: background-color 0.2s;
          position: sticky;
          left: 0;
          min-width: min-content;
          z-index: 50;
        }

        .dark .tree-header {
          background: #111827;
          border-bottom-color: #374151;
        }

        .tree-header-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
        }

        .dark .tree-header-title {
          color: #f9fafb;
        }

        .tree-header-chevron {
          width: 18px;
          height: 18px;
          color: #6b7280;
          transition: transform 0.2s;
        }

        .tree-header-chevron.expanded {
          transform: rotate(180deg);
        }

        .horizontal-tree-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
          padding: 24px;
          min-width: min-content;
        }

        /* --- Level 1 --- */
        .tree-level-1-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex-shrink: 0;
          margin-bottom: 10px; /* Gap before L2 starts */
          z-index: 20;
        }

        /* Connector from L1 to L2 Start */
        /* Removed fixed placement from wrapper::before */
        
        .tree-level-1-node.expanded::after {
            content: '';
            position: absolute;
            right: -22px;
            top: 22px;
            width: 2px;
            height: calc(100% - 20px + 32px);
            background: #cbd5e1;
            z-index: 1;
        }

        .tree-level-1-node.expanded::before {
             content: '';
             position: absolute;
             right: -22px;
             top: 22px;
             width: 22px;
             height: 2px;
             background: #cbd5e1;
             z-index: 1;
        }
        
        .dark .tree-level-1-node.expanded::after,
        .dark .tree-level-1-node.expanded::before {
            background: #4b5563;
        }

        .tree-level-1-node {
          display: inline-flex;
          align-items: flex-start; /* For wrap */
          justify-content: space-between;
          gap: 8px;
          padding: 10px 14px;
          width: 320px;
          min-height: 44px;
          height: auto;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          color: #4b5563;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          box-sizing: border-box;
          position: relative;
          line-height: 1.4;
        }

        .tree-level-1-node:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .dark .tree-level-1-node:hover {
          background: #374151;
        }

        .dark .tree-level-1-node {
          background: #1f2937;
          border-color: #4b5563;
          color: #9ca3af;
        }
        
        .tree-level-1-badge-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }
        
        .tree-level-1-label {
           word-break: break-word; /* wrap */
        }

        /* --- Level 2 Container --- */
        .tree-level-2-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
          margin-left: 340px; /* 320px L1 + 20px Gap */
        }

        /* --- Level 2 Child Item --- */
        .tree-level-2-node-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          margin-bottom: 24px;
          padding-left: 20px; /* Space for the branch line */
        }
        
        /* VERTICAL SPINE SEGMENT for L2 */
        .tree-level-2-node-wrapper::before {
            content: '';
            position: absolute;
            left: 0;
            width: 2px;
            background: #cbd5e1;
            top: -24px; /* Extend up to cover gap from previous sibling */
            bottom: 0;
        }
        
        /* First Child: Extend UP to meet L1 */
        .tree-level-2-node-wrapper:first-child::before {
            /* First child no longer reaches UP; Parent drop line meets it at the horizontal branch (22px) */
            top: 22px; 
        }
        
        /* Last Child: Stop at Node Center (22px) */
        .tree-level-2-node-wrapper:last-child::before {
            bottom: auto;
            /* Height = Top Offset + Node Center */
            /* Middle: 24 + 22 = 46px */
            height: 46px; 
        }
        
        /* Special Case: Only Child (First AND Last) */
        .tree-level-2-node-wrapper:first-child:last-child::before {
            top: 22px;
            height: 2px; /* Just a pixel to anchor if needed, but horizontal branch handles it */
            bottom: auto;
        }
        
        .dark .tree-level-2-node-wrapper::before {
            background: #4b5563;
        }

        /* HORIZONTAL BRANCH SEGMENT for L2 */
        .tree-level-2-node-wrapper::after {
            content: '';
            position: absolute;
            left: 0;
            top: 22px;
            width: 20px;
            height: 2px;
            background: #cbd5e1;
        }
        .dark .tree-level-2-node-wrapper::after {
            background: #4b5563;
        }

        .tree-level-2-node {
          display: inline-flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          width: 400px;
          min-height: 44px;
          height: auto;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          color: #111827;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          box-sizing: border-box;
          position: relative;
          z-index: 10;
          white-space: normal;
          line-height: 1.4;
        }

        .tree-level-2-node:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .dark .tree-level-2-node:hover {
          background: #374151;
        }

        .tree-level-2-node.expanded::before {
             content: '';
             position: absolute;
             right: -23px;
             top: 22px;
             width: 23px;
             height: 2px;
             background: #cbd5e1;
             z-index: 1;
        }
        
        .tree-level-2-node.expanded::after {
            content: '';
            position: absolute;
            right: -23px;
            top: 22px;
            /* Update Latest Values */
            height: calc(100% - 18px + 30px); 
            width: 2px;
            background: #cbd5e1;
            z-index: 1;
        }

        .dark .tree-level-2-node.expanded::before,
        .dark .tree-level-2-node.expanded::after {
            background: #4b5563;
        }

        .dark .tree-level-2-node {
           background: #1f2937;
           border-color: #4b5563;
           color: #f9fafb;
        }
        
        .tree-chevron {
           width: 20px; 
           height: 20px;
           color: #6b7280; /* Darker for better visibility */
           transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
           flex-shrink: 0;
        }
        
        .tree-chevron.expanded {
           transform: rotate(180deg);
        }
        
        .dark .tree-chevron {
           color: #9ca3af;
        }
        
        .tree-level-2-content {
           display: flex; 
           align-items: flex-start; /* wrap */
           gap: 10px; 
           flex: 1; 
        }

        /* --- Level 3 (Action Items) --- */
        .tree-level-3-container {
          display: flex;
          flex-direction: column;
          /* L2 Node width (400) + 20 Gap = 420. */
          margin-left: 420px;
          margin-top: 10px;
          position: relative;
        }
        
        /* Removed static bridge from Level 3 container */

        .tree-level-3-wrapper {
           position: relative;
           display: flex;
           align-items: center;
           margin-bottom: 12px;
           padding-left: 20px;
        }
        
        /* L3 Spine Segment */
        .tree-level-3-wrapper::before {
            content: '';
            position: absolute;
            left: 0;
            width: 2px;
            background: #cbd5e1;
            /* Default: connect from sibling above (-12px gap) */
            top: -12px;
            bottom: 0;
        }
        
        /* First L3: Parent drop line meets it at its branch center (20px) */
        .tree-level-3-wrapper:first-child::before {
             top: 20px;
        }
        
        /* Last L3: Stop at item center */
        .tree-level-3-wrapper:last-child::before {
            bottom: auto;
            position: absolute;
            top: -12px;
            height: 32px; 
        }
        
        /* Single L3 (First AND Last) */
        .tree-level-3-wrapper:first-child:last-child::before {
            top: 20px;
            height: 2px;
            bottom: auto;
        }
        
        .dark .tree-level-3-wrapper::before {
             background: #4b5563;
        }

        /* L3 Horizontal Branch */
        .tree-level-3-wrapper::after {
            content: '';
            position: absolute;
            left: 0;
            top: 20px; /* Center of 40px node */
            width: 20px;
            height: 2px;
            background: #cbd5e1;
        }
        .dark .tree-level-3-wrapper::after {
             background: #4b5563;
        }

        .tree-level-3-node {
          display: inline-flex;
          align-items: flex-start; /* wrap */
          gap: 10px;
          padding: 8px 14px;
          width: 320px;
          min-height: 40px;
          height: auto;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          color: #111827;
          font-size: 13px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.2s;
          box-sizing: border-box;
          position: relative;
          z-index: 10;
          white-space: normal; /* wrap */
          line-height: 1.4;
        }
        
        .dark .tree-level-3-node {
           background: #1f2937;
           border-color: #4b5563;
           color: #f9fafb;
        }
        
        .tree-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 5px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 700;
        }
      `}</style>

      {/* Header */}
      {headerTitle && (
        <div className="tree-header" onClick={handleHeaderToggle}>
          <span className="tree-header-title">{headerTitle}</span>
          <svg className={`tree-header-chevron ${isHeaderExpanded ? 'expanded' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}

      {/* Content */}
      {(!headerTitle || isHeaderExpanded) && (
        <div className="horizontal-tree-container">
          {/* Level 1 */}
          <div className="tree-level-1-wrapper">
             <button className={`tree-level-1-node ${rootNode.isExpanded ? 'expanded' : ''}`} onClick={rootNode.onClick}>
                <div className="tree-level-1-badge-wrapper">
                  <span className="tree-level-1-label">{rootNode.label}</span>
                  {rootNode.badge !== undefined && rootNode.badge > 0 && (
                     <span className="tree-badge">{rootNode.badge}</span>
                  )}
                </div>
                <svg className={`tree-chevron ${rootNode.isExpanded ? 'expanded' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
             </button>
          </div>

          {/* Level 2 */}
          {rootNode.isExpanded && rootNode.children && rootNode.children.length > 0 && (
            <div className="tree-level-2-wrapper">
              {rootNode.children.map((batchNode) => {
                 const hasChildren = batchNode.children && batchNode.children.length > 0;
                 return (
                   <div key={batchNode.id} className="tree-level-2-node-wrapper">
                      <button 
                        className={`tree-level-2-node ${batchNode.isExpanded ? 'expanded' : ''}`} 
                        onClick={batchNode.onClick}
                      >
                         <div className="tree-level-2-content">
                            {batchNode.icon || <FolderIcon />}
                            <span className="tree-level-2-label">{batchNode.label}</span>
                            {batchNode.badge !== undefined && batchNode.badge > 0 && (
                               <span className="tree-badge">{batchNode.badge}</span>
                            )}
                         </div>
                         {hasChildren && (
                            <svg className={`tree-chevron ${batchNode.isExpanded ? 'expanded' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                         )}
                      </button>

                      {/* Level 3 Children */}
                      {batchNode.isExpanded && hasChildren && (
                         <div className="tree-level-3-container">
                            {batchNode.children!.map((actionNode) => (
                               <div key={actionNode.id} className="tree-level-3-wrapper">
                                  <button className="tree-level-3-node" onClick={actionNode.onClick}>
                                     {actionNode.icon || <DocumentIcon />}
                                     <span className="tree-level-3-label">{actionNode.label}</span>
                                     {actionNode.badge !== undefined && actionNode.badge > 0 && (
                                        <span className="tree-badge">{actionNode.badge}</span>
                                     )}
                                  </button>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                 );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
