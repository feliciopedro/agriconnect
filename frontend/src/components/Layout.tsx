import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { role } = useAuth();

  const isActive = (path: string) =>
    location.pathname === path ||
    (path === '/farmer' && location.pathname.startsWith('/farmer')) ||
    (path === '/marketplace' && location.pathname.startsWith('/marketplace')) ||
    (path === '/orders' && location.pathname.startsWith('/orders')) ||
    (path === '/transporter' && location.pathname.startsWith('/transporter'));

  return (
    <div className="min-h-screen flex flex-col bg-white text-text-primary">
      {/* Header / Top navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-border-default">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary-green flex items-center justify-center shadow-md shadow-primary-green/10">
                <span className="font-bold text-white text-lg">A</span>
              </div>
              <span className="text-xl font-bold text-primary-green tracking-tight">
                AgriConnect
              </span>
            </div>

            {/* Navigation links */}
            <nav className="flex space-x-1 sm:space-x-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all-custom ${
                  isActive('/')
                    ? 'bg-primary-light text-primary-green border-l-[3px] border-l-primary-green rounded-l-none'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                }`}
              >
                Marketplace Home
              </Link>
              <Link
                to="/health"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all-custom ${
                  isActive('/health')
                    ? 'bg-primary-light text-primary-green border-l-[3px] border-l-primary-green rounded-l-none'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                }`}
              >
                API Status
              </Link>
              {role === 'FARMER' && (
                <Link
                  to="/farmer"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all-custom ${
                    isActive('/farmer')
                      ? 'bg-primary-light text-primary-hover border-l-[3px] border-l-primary rounded-l-none'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                  }`}
                >
                  My Listings
                </Link>
              )}
              {role === 'BUYER' && (
                <>
                  <Link
                    to="/marketplace"
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all-custom ${
                      isActive('/marketplace')
                        ? 'bg-primary-light text-primary-hover border-l-[3px] border-l-primary rounded-l-none'
                        : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                    }`}
                  >
                    Marketplace
                  </Link>
                  <Link
                    to="/orders"
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all-custom ${
                      isActive('/orders')
                        ? 'bg-primary-light text-primary-hover border-l-[3px] border-l-primary rounded-l-none'
                        : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                    }`}
                  >
                    My Orders
                  </Link>
                </>
              )}
              {(role === 'TRANSPORT' || role === 'TRANSPORTER') && (
                <Link
                  to="/transporter"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all-custom ${
                    isActive('/transporter')
                      ? 'bg-primary-light text-primary-hover border-l-[3px] border-l-primary rounded-l-none'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                  }`}
                >
                  Deliveries
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-white">
        <div className="animate-[fadeIn_0.5s_ease-out]">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-border-default py-6">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              © {new Date().getFullYear()} AgriConnect Ghana. Connecting farmers, buyers, & transporters.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>Powered by React + Express + Prisma</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default Layout;
