import { useRef, useEffect } from "react";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { ModuleProvider } from "../context/ModuleContext";
import { MenuLayoutProvider, useMenuLayout } from "../context/MenuLayoutContext";
import { Outlet, useLocation } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import BottomNavigation from "../components/layout/BottomNavigation";
import SubMenuTabs from "../components/layout/SubMenuTabs";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { menuLayout } = useMenuLayout();
  const location = useLocation();

  // Fade-in on route change for smoother page transitions
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    // Force reflow so the transition fires
    void el.offsetHeight;
    el.style.transition = "opacity 0.2s ease-out, transform 0.2s ease-out";
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  }, [location.pathname]);
  
  // Determine if we should show SubMenuTabs based on current route
  const parentMenuName = (() => {
    const pathname = location.pathname;
    // Map routes to parent menu names
    if (pathname.includes("/transcriptkickouts") || 
        pathname.includes("/transcript_articulationkickouts") || 
        pathname.includes("/transcriptprocessed") || 
        pathname.includes("/transcriptrerun")) {
      return "Transcripts";
    }
    if (pathname.includes("/articulationkickouts") || 
        pathname.includes("/articulationphase2kickouts") || 
        pathname.includes("/articulationprocessed") || 
        pathname.includes("/articulationrerun")) {
      return "Articulation";
    }
    if (pathname.includes("/transcriptreports") || 
        pathname.includes("/transcriptequivalenthours") || 
        pathname.includes("/articulationreports") || 
        pathname.includes("/digiscriptreports")) {
      return "Reports";
    }
    if (pathname.includes("/transcripts/add") || 
        pathname.includes("/transcripts") && !pathname.includes("/transcriptreports")) {
      return "College Uploads";
    }
    return null;
  })();

  // Horizontal menu layout
  if (menuLayout === "horizontal") {
    return (
      <div className="min-h-screen flex flex-col" style={{ overflowX: 'hidden', width: '100%', maxWidth: '100vw' }}>
        <AppHeader />
        <div className="flex-1 flex flex-col pb-16 md:pb-0" style={{ overflowX: 'hidden', width: '100%' }}>
          <div className="relative" style={{ zIndex: 100 }}>
            <AppSidebar />
          </div>
          <div className="flex-1 p-4 mx-auto max-w-(--breakpoint-2xl) md:p-4" style={{ zIndex: 1, position: 'relative', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            {parentMenuName && <SubMenuTabs parentMenuName={parentMenuName} />}
            <div ref={pageRef}>
              <Outlet />
            </div>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  // Vertical menu layout (default)
  return (
    <div className="min-h-screen xl:flex" style={{ overflowX: 'hidden', width: '100%', maxWidth: '100vw' }}>
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
        style={{ overflowX: 'hidden', width: '100%', maxWidth: '100%' }}
      >
        <AppHeader />
        {parentMenuName && <SubMenuTabs parentMenuName={parentMenuName} />}
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-4 pb-20 md:pb-4" style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
          <div ref={pageRef}>
            <Outlet />
          </div>
        </div>
        <BottomNavigation />
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <ModuleProvider>
      <MenuLayoutProvider>
        <SidebarProvider>
          <LayoutContent />
        </SidebarProvider>
      </MenuLayoutProvider>
    </ModuleProvider>
  );
};

export default AppLayout;
