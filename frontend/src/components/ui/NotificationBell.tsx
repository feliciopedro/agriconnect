import React from 'react';
import { Bell, ShoppingBag, Truck, MessageSquare, Settings } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { NotificationsApi } from '../../api/notifications.api';
import NotificationsDropdown from './NotificationsDropdown';
import type { Notification } from '../../api/notifications.api';

/**
 * NotificationBell component renders a bell icon with an unread count badge.
 * Clicking the bell toggles a dropdown panel that shows recent notifications.
 */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Fetch notifications (auto‑poll every 12s)
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: NotificationsApi.getNotifications,
    refetchInterval: 12000,
  });

  const notifications = (data?.notifications ?? []) as Notification[];
  const unreadCount = data?.unreadCount ?? 0;

  // Mutations for marking read / all read
  const markAllReadMutation = useMutation({
    mutationFn: NotificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
    onError: () => toast.error('Failed to mark notifications as read'),
  });

  const markReadMutation = useMutation({
    mutationFn: NotificationsApi.markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    } catch {
      return '';
    }
  };

  const getNotificationDetails = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ORDER':
        return {
          icon: <ShoppingBag size={15} className="text-[#2D6A4F]" />, // order icon
          bgColor: 'bg-[#EAF4EE]',
          route: '/orders',
        };
      case 'DELIVERY':
        return {
          icon: <Truck size={15} className="text-[#C8960C]" />, // delivery icon
          bgColor: 'bg-[#FEF9EC]',
          route: '/orders',
        };
      case 'MESSAGE':
      case 'NEW_MESSAGE':
        return {
          icon: <MessageSquare size={15} className="text-[#1D4ED8]" />, // message icon
          bgColor: 'bg-[#EFF6FF]',
          route: '/messages',
        };
      default:
        return {
          icon: <Settings size={15} className="text-[#4B5563]" />, // fallback
          bgColor: 'bg-[#F3F4F6]',
          route: '/notifications',
        };
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    setDropdownOpen(false);
    const details = getNotificationDetails(n.type);
    navigate(details.route);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors relative flex items-center justify-center cursor-pointer group"
      >
        <Bell
          size={20}
          className={`transition-colors ${
            unreadCount > 0 ? 'text-[#111827] fill-[#111827]/10' : 'text-[#6B7280] group-hover:text-[#111827]'
          }`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-[16px] h-[16px] bg-[#DC2626] text-white text-[11px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <NotificationsDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllReadMutation.mutate}
          markAllReadLoading={markAllReadMutation.isPending}
          onNotificationClick={handleNotificationClick}
        />
      )}
    </div>
  );
};
