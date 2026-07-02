import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="font-bold text-slate-950 text-lg">A</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent tracking-tight">
                AgriConnect
              </span>
            </div>

            {/* Navigation links */}
            <nav className="flex space-x-1 sm:space-x-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all-custom ${
                  isActive('/')
                    ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500 rounded-b-none'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                Marketplace Home
              </Link>
              <Link
                to="/health"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all-custom ${
                  isActive('/health')
                    ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500 rounded-b-none'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                API Status
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-[fadeIn_0.5s_ease-out]">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">
              © {new Date().getFullYear()} AgriConnect Ghana. Connecting farmers, buyers, & transporters.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Powered by React + Express + Prisma</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
