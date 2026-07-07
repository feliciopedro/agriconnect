import React from 'react';
import { Sidebar } from './shell/Sidebar';
import { Navbar } from './shell/Navbar';
import { BottomNav } from './shell/BottomNav';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * AppShell — the root layout wrapper for all protected pages.
 *
 * Desktop (lg+):
 *   240px fixed white sidebar | scrollable content area
 *
 * Mobile (<lg):
 *   56px top Navbar | scrollable content | 60px BottomNav
 *   Hamburger opens a slide-over drawer with the full Sidebar.
 */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  // Close drawer on escape key
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-text-primary">

      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-[#E5E7EB] bg-white overflow-y-auto">
        <Sidebar />
      </aside>

      {/* ── Right side: Navbar + content + BottomNav ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top Navbar */}
        <Navbar onMenuOpen={openDrawer} />

        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="animate-[fadeIn_0.3s_ease-out]">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <BottomNav />
      </div>

      {/* ── Mobile slide-over drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            style={{ animation: 'fadeInBackdrop 0.2s ease-out' }}
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <aside
            className="absolute left-0 top-0 bottom-0 w-[240px] bg-white flex flex-col border-r border-[#E5E7EB] overflow-y-auto shadow-xl"
            style={{ animation: 'slideInLeft 0.22s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <Sidebar onClose={closeDrawer} />
          </aside>
        </div>
      )}
    </div>
  );
};

export default Layout;
