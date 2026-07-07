import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Package,
  Truck,
  MessageSquare,
  Bell,
  LayoutGrid,
  BarChart2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { NotificationsApi } from '../../api/notifications.api';

// ─── Tab config ───────────────────────────────────────────────────────────────

interface Tab {
  label: string;
  to: string;
  icon: React.ReactNode;
  matchPrefix?: string;
}

function getTabs(role: string | null): Tab[] {
  const messages: Tab = { label: 'Messages', to: '/messages', icon: <MessageSquare size={20} /> };
  const notifications: Tab = { label: 'Alerts', to: '/notifications', icon: <Bell size={20} /> };

  switch (role) {
    case 'FARMER':
      return [
        { label: 'Home', to: '/', icon: <Home size={20} /> },
        { label: 'Listings', to: '/farmer', icon: <LayoutGrid size={20} />, matchPrefix: '/farmer' },
        { label: 'Orders', to: '/orders', icon: <Package size={20} />, matchPrefix: '/orders' },
        messages,
        notifications,
      ];

    case 'BUYER':
      return [
        { label: 'Market', to: '/marketplace', icon: <Home size={20} />, matchPrefix: '/marketplace' },
        { label: 'Orders', to: '/orders', icon: <Package size={20} />, matchPrefix: '/orders' },
        messages,
        notifications,
      ];

    case 'TRANSPORT':
    case 'TRANSPORTER':
      return [
        { label: 'Available', to: '/transporter', icon: <Truck size={20} />, matchPrefix: '/transporter' },
        messages,
        notifications,
      ];

    case 'ADMIN':
    case 'SUPERADMIN':
      return [
        { label: 'Overview', to: '/admin', icon: <BarChart2 size={20} />, matchPrefix: '/admin' },
        messages,
      ];

    default:
      return [
        { label: 'Home', to: '/', icon: <Home size={20} /> },
        messages,
        notifications,
      ];
  }
}

// ─── BottomNav ────────────────────────────────────────────────────────────────

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { role } = useAuth();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: NotificationsApi.getNotifications,
    refetchInterval: 12000,
  });
  const unreadCount = notifData?.unreadCount ?? 0;

  const tabs = getTabs(role);

  const isActive = (tab: Tab) => {
    if (tab.to === '/' && !tab.matchPrefix) return location.pathname === '/';
    const prefix = tab.matchPrefix ?? tab.to;
    return location.pathname === prefix || location.pathname.startsWith(prefix + '/');
  };

  return (
    /* Mobile only — hidden on lg+ */
    <nav
      className="lg:hidden bg-white border-t border-[#E5E7EB] shrink-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-[60px]">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const isNotif = tab.to === '/notifications';
          return (
            <Link
              key={tab.to + tab.label}
              to={tab.to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors relative ${
                active ? 'text-[#2D6A4F]' : 'text-[#9CA3AF] hover:text-[#6B7280]'
              }`}
            >
              <span className="relative">
                {tab.icon}
                {isNotif && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-[#DC2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
              {/* Active indicator dot */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#2D6A4F] rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
