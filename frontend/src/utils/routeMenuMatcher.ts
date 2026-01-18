/**
 * Utility to match routes to their parent menu items
 * Used to show SubMenuTabs when navigating to pages with submenus
 */

export const getParentMenuNameFromRoute = (pathname: string): string | null => {
  // Map route patterns to parent menu names
  const routePatterns: Record<string, string> = {
    // Transcripts routes
    "/college/transcriptkickouts": "Transcripts",
    "/college/transcript_articulationkickouts": "Transcripts",
    "/college/transcriptprocessed": "Transcripts",
    "/college/transcriptrerun": "Transcripts",
    
    // Articulation routes
    "/college/articulationkickouts": "Articulation",
    "/college/articulationphase2kickouts": "Articulation",
    "/college/articulationprocessed": "Articulation",
    "/college/articulationrerun": "Articulation",
    
    // Reports routes
    "/college/transcriptreports": "Reports",
    "/college/transcriptequivalenthours": "Reports",
    "/college/articulationreports": "Reports",
    "/college/digiscriptreports": "Reports",
    
    // Uploads routes
    "/college/transcripts/add": "College Uploads",
    "/college/transcripts": "College Uploads",
  };

  // Check exact matches first
  if (routePatterns[pathname]) {
    return routePatterns[pathname];
  }

  // Check prefix matches
  for (const [pattern, menuName] of Object.entries(routePatterns)) {
    if (pathname.startsWith(pattern)) {
      return menuName;
    }
  }

  return null;
};
