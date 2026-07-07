import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  ShoppingCart,
  Package,
  Truck,
  MessageSquare,
  Bell,
  LogOut,
  Users,
  Search,
  BarChart2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { useQuery } from '@tanstack/react-query';
import { NotificationsApi } from '../../api/notifications.api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  /** match prefix for active check */
  matchPrefix?: string;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

interface SidebarProps {
  /** Called when a nav link is clicked (closes mobile drawer) */
  onClose?: () => void;
}

// ─── Nav config per role ──────────────────────────────────────────────────────

function getNavSections(role: string | null): NavSection[] {
  const messages: NavItem = {
    label: 'Messages',
    to: '/messages',
    icon: <MessageSquare size={18} />,
  };
  const notifications: NavItem = {
    label: 'Notifications',
    to: '/notifications',
    icon: <Bell size={18} />,
  };

  switch (role) {
    case 'FARMER':
      return [
        {
          heading: 'MAIN',
          items: [
            { label: 'Home', to: '/', icon: <Home size={18} /> },
          ],
        },
        {
          heading: 'MANAGE',
          items: [
            { label: 'My Listings', to: '/farmer', icon: <LayoutGrid size={18} />, matchPrefix: '/farmer' },
            { label: 'Orders', to: '/orders', icon: <ShoppingCart size={18} />, matchPrefix: '/orders' },
          ],
        },
        {
          heading: 'ACCOUNT',
          items: [messages, notifications],
        },
      ];

    case 'BUYER':
      return [
        {
          heading: 'MAIN',
          items: [
            { label: 'Marketplace', to: '/marketplace', icon: <Home size={18} />, matchPrefix: '/marketplace' },
          ],
        },
        {
          heading: 'MANAGE',
          items: [
            { label: 'My Orders', to: '/orders', icon: <Package size={18} />, matchPrefix: '/orders' },
          ],
        },
        {
          heading: 'ACCOUNT',
          items: [messages, notifications],
        },
      ];

    case 'TRANSPORT':
    case 'TRANSPORTER':
      return [
        {
          heading: 'MAIN',
          items: [
            { label: 'Available', to: '/transporter', icon: <Truck size={18} />, matchPrefix: '/transporter' },
          ],
        },
        {
          heading: 'MANAGE',
          items: [
            { label: 'My Jobs', to: '/transporter', icon: <ShoppingCart size={18} />, matchPrefix: '/transporter' },
          ],
        },
        {
          heading: 'ACCOUNT',
          items: [messages, notifications],
        },
      ];

    case 'ADMIN':
    case 'SUPERADMIN':
      return [
        {
          heading: 'MAIN',
          items: [
            { label: 'Overview', to: '/admin', icon: <BarChart2 size={18} />, matchPrefix: '/admin' },
            { label: 'Users', to: '/admin/users', icon: <Users size={18} /> },
            { label: 'Trace Lookup', to: '/admin/trace', icon: <Search size={18} /> },
          ],
        },
        {
          heading: 'ACCOUNT',
          items: [messages],
        },
      ];

    default:
      return [
        {
          heading: 'MAIN',
          items: [{ label: 'Home', to: '/', icon: <Home size={18} /> }],
        },
        {
          heading: 'ACCOUNT',
          items: [messages, notifications],
        },
      ];
  }
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  // Unread notifications count for the bell badge
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: NotificationsApi.getNotifications,
    refetchInterval: 12000,
  });
  const unreadCount = notifData?.unreadCount ?? 0;

  const sections = getNavSections(role);

  // Active check — exact match for '/', prefix match for others
  const isActive = (item: NavItem) => {
    if (item.to === '/' && !item.matchPrefix) {
      return location.pathname === '/';
    }
    const prefix = item.matchPrefix ?? item.to;
    return location.pathname === item.to || location.pathname.startsWith(prefix + '/') || location.pathname === prefix;
  };

  // Initials from name
  const initials = user?.name
    ? user.name
        .trim()
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '?';

  const roleLabel = role ?? 'USER';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLink = () => {
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* ── Logo / brand ── */}
      <div className="px-6 pt-6 pb-5 shrink-0">
        <div className="flex items-end gap-2">
          <Link
            to="/"
            onClick={handleLink}
            className="font-display text-[20px] font-bold text-[#2D6A4F] leading-none tracking-tight hover:opacity-90 transition-opacity"
          >
            AgriConnect
          </Link>
          <span className="text-[11px] text-[#9CA3AF] font-medium mb-0.5">v1.0</span>
        </div>
      </div>

      {/* ── User card ── */}
      <div className="mx-0 border-y border-[#E5E7EB] px-4 py-3.5 shrink-0">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-[#2D6A4F] flex items-center justify-center shrink-0">
            <span className="text-white text-[12px] font-bold">{initials}</span>
          </div>
          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#111827] truncate leading-tight">
              {user?.name ?? 'User'}
            </p>
            <Badge variant="primary" size="sm" label={roleLabel} className="mt-0.5" />
          </div>
        </div>
        <Link
          to="/notifications"
          onClick={handleLink}
          className="mt-2 block text-[12px] text-[#2D6A4F] font-semibold hover:text-[#235A41] hover:underline transition-colors"
        >
          View Profile
        </Link>
      </div>

      {/* ── Nav sections ── */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {sections.map((section) => (
          <div key={section.heading} className="space-y-1">
            {/* Section label */}
            <p
              className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.08em] px-3 mb-2"
            >
              {section.heading}
            </p>

            {/* Nav items */}
            {section.items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.to + item.label}
                  to={item.to}
                  onClick={handleLink}
                  className={`flex items-center gap-3 h-10 px-3 rounded-lg text-[14px] font-medium transition-all duration-150 relative ${
                    active
                      ? 'bg-[#EAF4EE] text-[#2D6A4F] font-semibold border-l-[3px] border-[#2D6A4F] pl-[9px]'
                      : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
                  }`}
                >
                  {/* Icon */}
                  <span className="shrink-0">{item.icon}</span>
                  {/* Label */}
                  <span className="flex-1 truncate">{item.label}</span>
                  {/* Unread badge on Notifications */}
                  {item.to === '/notifications' && unreadCount > 0 && (
                    <span className="w-5 h-5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Logout ── */}
      <div className="shrink-0 px-4 pb-6 pt-2 border-t border-[#F3F4F6]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[14px] font-medium text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all duration-150 cursor-pointer"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
