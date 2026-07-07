import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, ShoppingBag, Truck, MessageSquare, Settings } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationsApi } from '../../api/notifications.api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// ─── Route title map ──────────────────────────────────────────────────────────

const ROUTE_TITLES: { prefix: string; title: string }[] = [
  { prefix: '/farmer/listings/new', title: 'New Listing' },
  { prefix: '/farmer/listings/edit', title: 'Edit Listing' },
  { prefix: '/farmer/listings', title: 'Listing Detail' },
  { prefix: '/farmer', title: 'My Listings' },
  { prefix: '/marketplace/listings', title: 'Listing Detail' },
  { prefix: '/marketplace', title: 'Marketplace' },
  { prefix: '/orders', title: 'My Orders' },
  { prefix: '/transporter/deliveries', title: 'Delivery Detail' },
  { prefix: '/transporter', title: 'Deliveries' },
  { prefix: '/messages', title: 'Messages' },
  { prefix: '/notifications', title: 'Notifications' },
  { prefix: '/admin/users', title: 'Admin — Users' },
  { prefix: '/admin/trace', title: 'Admin — Trace' },
  { prefix: '/admin', title: 'Admin Overview' },
  { prefix: '/setup-profile', title: 'Setup Profile' },
  { prefix: '/', title: 'Home' },
];

function getPageTitle(pathname: string): string {
  for (const { prefix, title } of ROUTE_TITLES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix)) {
      return title;
    }
  }
  return 'AgriConnect';
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

interface NavbarProps {
  onMenuOpen: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const pageTitle = getPageTitle(location.pathname);

  // Notifications query
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: NotificationsApi.getNotifications,
    refetchInterval: 12000,
  });
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Mark all read
  const markAllReadMutation = useMutation({
    mutationFn: NotificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
    onError: () => toast.error('Failed to mark notifications as read'),
  });

  // Mark single read
  const markReadMutation = useMutation({
    mutationFn: NotificationsApi.markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotifDetails = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ORDER':
        return { icon: <ShoppingBag size={14} className="text-[#2D6A4F]" />, bg: 'bg-[#EAF4EE]', route: '/orders' };
      case 'DELIVERY':
        return {
          icon: <Truck size={14} className="text-[#C8960C]" />,
          bg: 'bg-[#FEF9EC]',
          route: role === 'TRANSPORT' || role === 'TRANSPORTER' ? '/transporter' : '/orders',
        };
      case 'MESSAGE':
      case 'NEW_MESSAGE':
        return { icon: <MessageSquare size={14} className="text-[#1D4ED8]" />, bg: 'bg-[#EFF6FF]', route: '/messages' };
      default:
        return { icon: <Settings size={14} className="text-[#4B5563]" />, bg: 'bg-[#F3F4F6]', route: '/notifications' };
    }
  };

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    /* Mobile only — hidden on lg+ (sidebar takes over) */
    <header className="lg:hidden bg-white border-b border-[#E5E7EB] px-4 h-14 flex items-center justify-between shrink-0 z-40">
      {/* Menu button */}
      <button
        onClick={onMenuOpen}
        aria-label="Open menu"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <span className="text-[16px] font-semibold text-[#111827] truncate">{pageTitle}</span>

      {/* Bell + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="Notifications"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer relative"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-32px)] bg-white border border-[#E5E7EB] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <span className="text-sm font-bold text-[#111827]">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-xs font-bold text-[#2D6A4F] cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Items */}
            <div className="max-h-[280px] overflow-y-auto divide-y divide-[#F3F4F6]">
              {notifications.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#9CA3AF] font-semibold">
                  🔔 No notifications yet.
                </p>
              ) : (
                notifications.slice(0, 5).map((n) => {
                  const d = getNotifDetails(n.type);
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.isRead) markReadMutation.mutate(n.id);
                        setDropdownOpen(false);
                        navigate(d.route);
                      }}
                      className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                        !n.isRead
                          ? 'bg-[#EAF4EE]/40 border-l-[3px] border-l-[#2D6A4F]'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full ${d.bg} flex items-center justify-center shrink-0`}>
                        {d.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] leading-snug ${!n.isRead ? 'font-bold text-[#111827]' : 'text-[#6B7280]'}`}>
                          {n.message}
                        </p>
                        <span className="text-[11px] text-[#9CA3AF] font-medium">{formatRelative(n.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <Link
              to="/notifications"
              onClick={() => setDropdownOpen(false)}
              className="block text-center py-2.5 border-t border-[#E5E7EB] text-xs font-bold text-[#2D6A4F] bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              View all →
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
