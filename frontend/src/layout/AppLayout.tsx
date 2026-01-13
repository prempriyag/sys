import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { ModuleProvider } from "../context/ModuleContext";
import { MenuLayoutProvider, useMenuLayout } from "../context/MenuLayoutContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { menuLayout } = useMenuLayout();

  // Horizontal menu layout
  if (menuLayout === "horizontal") {
    return (
      <div className="min-h-screen flex flex-col" style={{ overflowX: 'hidden', width: '100%', maxWidth: '100vw' }}>
        <AppHeader />
        <div className="flex-1 flex flex-col" style={{ overflowX: 'hidden', width: '100%' }}>
          <div className="relative" style={{ zIndex: 100 }}>
            <AppSidebar />
          </div>
          <div className="flex-1 p-4 mx-auto max-w-(--breakpoint-2xl) md:p-4" style={{ zIndex: 1, position: 'relative', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            <Outlet />
          </div>
        </div>
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
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-4" style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
          <Outlet />
        </div>
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
