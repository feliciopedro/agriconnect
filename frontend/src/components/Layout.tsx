import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, ShoppingBag, Truck, MessageSquare, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationsApi } from '../api/notifications.api';
import toast from 'react-hot-toast';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Fetch notifications
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: NotificationsApi.getNotifications,
    refetchInterval: 12000, // auto-poll every 12 seconds
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount ?? 0;

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: NotificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
    onError: () => {
      toast.error('Failed to mark notifications as read');
    },
  });

  // Mark single read mutation
  const markReadMutation = useMutation({
    mutationFn: NotificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Click outside to close dropdown hook
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) =>
    location.pathname === path ||
    (path === '/farmer' && location.pathname.startsWith('/farmer')) ||
    (path === '/marketplace' && location.pathname.startsWith('/marketplace')) ||
    (path === '/orders' && location.pathname.startsWith('/orders')) ||
    (path === '/transporter' && location.pathname.startsWith('/transporter')) ||
    (path === '/messages' && location.pathname.startsWith('/messages')) ||
    (path === '/notifications' && location.pathname.startsWith('/notifications'));

  // Notification type formatting helper
  const getNotificationDetails = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ORDER':
        return {
          icon: <ShoppingBag size={15} className="text-[#2D6A4F]" />,
          bgColor: 'bg-[#EAF4EE]',
          route: '/orders',
        };
      case 'DELIVERY':
        return {
          icon: <Truck size={15} className="text-[#C8960C]" />,
          bgColor: 'bg-[#FEF9EC]',
          route: role === 'TRANSPORT' || role === 'TRANSPORTER' ? '/transporter' : '/orders',
        };
      case 'MESSAGE':
      case 'NEW_MESSAGE':
        return {
          icon: <MessageSquare size={15} className="text-[#1D4ED8]" />,
          bgColor: 'bg-[#EFF6FF]',
          route: '/messages',
        };
      default:
        return {
          icon: <Settings size={15} className="text-[#4B5563]" />,
          bgColor: 'bg-[#F3F4F6]',
          route: '/notifications',
        };
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch (e) {
      return '';
    }
  };

  const handleNotificationClick = (n: any) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    setDropdownOpen(false);
    const details = getNotificationDetails(n.type);
    navigate(details.route);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-text-primary">
      {/* Header / Top navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-border-default">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 select-none hover:opacity-90 transition-opacity">
              <div className="w-9 h-9 rounded-xl bg-primary-green flex items-center justify-center shadow-md shadow-primary-green/10">
                <span className="font-bold text-white text-lg">A</span>
              </div>
              <span className="text-xl font-bold text-primary-green tracking-tight font-display">
                AgriConnect
              </span>
            </Link>

            {/* Navigation links */}
            <div className="flex items-center gap-4 sm:gap-6">
              <nav className="flex items-center space-x-1 sm:space-x-3">
                <Link
                  to="/"
                  className={`px-2.5 py-1.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-all duration-200 ${
                    isActive('/')
                      ? 'bg-primary-light text-primary-green'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                  }`}
                >
                  Marketplace
                </Link>
                {role === 'FARMER' && (
                  <Link
                    to="/farmer"
                    className={`px-2.5 py-1.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-all duration-200 ${
                      isActive('/farmer')
                        ? 'bg-primary-light text-primary-green'
                        : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                    }`}
                  >
                    My Listings
                  </Link>
                )}
                {role === 'BUYER' && (
                  <Link
                    to="/orders"
                    className={`px-2.5 py-1.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-all duration-200 ${
                      isActive('/orders')
                        ? 'bg-primary-light text-primary-green'
                        : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                    }`}
                  >
                    My Orders
                  </Link>
                )}
                {(role === 'TRANSPORT' || role === 'TRANSPORTER') && (
                  <Link
                    to="/transporter"
                    className={`px-2.5 py-1.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-all duration-200 ${
                      isActive('/transporter')
                        ? 'bg-primary-light text-primary-green'
                        : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                    }`}
                  >
                    Deliveries
                  </Link>
                )}
                <Link
                  to="/messages"
                  className={`px-2.5 py-1.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-all duration-200 ${
                    isActive('/messages')
                      ? 'bg-primary-light text-primary-green'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[#F9FAFB]'
                  }`}
                >
                  Messages
                </Link>
              </nav>

              {/* Notification Bell Dropdown Button */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors relative flex items-center justify-center cursor-pointer group"
                >
                  <Bell
                    size={20}
                    className={`transition-colors ${
                      unreadCount > 0
                        ? 'text-[#111827] fill-[#111827]/10'
                        : 'text-[#6B7280] group-hover:text-[#111827]'
                    }`}
                  />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-[16px] h-[16px] bg-[#DC2626] text-white text-[11px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown Box */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-3.5 w-[360px] max-w-[calc(100vw-32px)] bg-white border border-[#E5E7EB] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
                    {/* Header */}
                    <div className="px-4 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between bg-white">
                      <span className="font-extrabold text-sm text-[#111827]">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          disabled={markAllReadMutation.isPending}
                          className="text-xs font-bold text-[#2D6A4F] hover:text-[#1B4332] transition-colors bg-transparent border-0 cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* Content List */}
                    <div className="max-h-[320px] overflow-y-auto divide-y divide-[#F3F4F6] bg-white">
                      {notifications.length === 0 ? (
                        <div className="py-8 px-4 text-center text-xs font-semibold text-[#9CA3AF]">
                          🔔 No notifications yet.
                        </div>
                      ) : (
                        notifications.slice(0, 5).map((n) => {
                          const details = getNotificationDetails(n.type);
                          return (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-4 flex items-start gap-3 transition-colors cursor-pointer select-none ${
                                !n.isRead
                                  ? 'bg-[#EAF4EE]/40 border-l-[3px] border-l-[#2D6A4F]'
                                  : 'bg-white hover:bg-gray-50'
                              }`}
                            >
                              {/* Icon container */}
                              <div className={`w-8 h-8 rounded-full ${details.bgColor} flex items-center justify-center shrink-0`}>
                                {details.icon}
                              </div>
                              {/* Text message */}
                              <div className="flex-grow space-y-0.5 min-w-0">
                                <p className={`text-[13px] leading-tight ${
                                  !n.isRead ? 'font-bold text-[#111827]' : 'text-[#6B7280]'
                                }`}>
                                  {n.message}
                                </p>
                                <span className="text-[11px] font-semibold text-[#9CA3AF] block">
                                  {formatRelativeTime(n.createdAt)}
                                </span>
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
                      className="block text-center py-3 bg-gray-50 hover:bg-gray-100/80 border-t border-[#E5E7EB] text-xs font-bold text-[#2D6A4F] hover:text-[#1B4332] transition-colors"
                    >
                      View all notifications →
                    </Link>
                  </div>
                )}
              </div>
            </div>

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
            <span className="text-sm text-text-secondary font-medium">
              © {new Date().getFullYear()} AgriConnect Ghana. Connecting farmers, buyers, & transporters.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-text-muted">
            <Link to="/health" className="hover:text-primary-green transition-colors">API System Status</Link>
            <span>·</span>
            <span>Powered by React + Express + Prisma</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default Layout;
