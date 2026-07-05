import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Truck, MessageSquare, Settings, CheckCheck } from 'lucide-react';
import { NotificationsApi } from '../api/notifications.api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  
  // Local pagination state
  const [visibleCount, setVisibleCount] = React.useState(10);

  // Fetch notifications list
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: NotificationsApi.getNotifications,
  });

  const notifications = data?.notifications || [];

  // Mark single notification read
  const markReadMutation = useMutation({
    mutationFn: NotificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

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

  // Type-to-icon details mapper
  const getNotificationDetails = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ORDER':
        return {
          icon: <ShoppingBag size={18} className="text-[#2D6A4F]" />,
          bgColor: 'bg-[#EAF4EE]',
          route: '/orders',
        };
      case 'DELIVERY':
        return {
          icon: <Truck size={18} className="text-[#C8960C]" />,
          bgColor: 'bg-[#FEF9EC]',
          route: role === 'TRANSPORT' || role === 'TRANSPORTER' ? '/transporter' : '/orders',
        };
      case 'MESSAGE':
      case 'NEW_MESSAGE':
        return {
          icon: <MessageSquare size={18} className="text-[#1D4ED8]" />,
          bgColor: 'bg-[#EFF6FF]',
          route: '/messages',
        };
      default:
        return {
          icon: <Settings size={18} className="text-[#4B5563]" />,
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

  const handleRowClick = (n: any) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    const details = getNotificationDetails(n.type);
    navigate(details.route);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const paginatedNotifications = notifications.slice(0, visibleCount);

  if (isLoading) {
    return (
      <div className="max-w-[680px] mx-auto space-y-6 py-6">
        <div className="flex justify-between items-center pb-4 border-b border-[#E5E7EB]">
          <div className="h-8 w-40 bg-[#F3F4F6] animate-pulse rounded-md" />
          <div className="h-5 w-24 bg-[#F3F4F6] animate-pulse rounded-md" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-[#F3F4F6] animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto py-6 space-y-8 bg-white">
      {/* Title Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB] bg-white">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight font-display">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-xs text-text-secondary font-medium">
              You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            leftIcon={<CheckCheck size={15} />}
            className="text-[#2D6A4F] border-[#2D6A4F]/20 hover:bg-[#EAF4EE]/40 h-9 font-bold"
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* List Feed */}
      <div className="space-y-3.5 bg-white">
        {notifications.length === 0 ? (
          <Card className="py-12 text-center border border-[#E5E7EB] bg-white flex flex-col items-center justify-center space-y-3">
            <span className="text-4xl select-none">🔔</span>
            <div>
              <h3 className="text-base font-bold text-text-primary">No Notifications Yet</h3>
              <p className="text-xs text-text-secondary mt-1">
                We'll let you know when there are updates on your listings, orders, or messaging threads.
              </p>
            </div>
          </Card>
        ) : (
          <div className="divide-y divide-[#F3F4F6] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm bg-white">
            {paginatedNotifications.map((n) => {
              const details = getNotificationDetails(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => handleRowClick(n)}
                  className={`p-4 flex items-start gap-4 transition-colors cursor-pointer select-none ${
                    !n.isRead
                      ? 'bg-[#EAF4EE]/30 border-l-[3.5px] border-l-[#2D6A4F]'
                      : 'bg-white hover:bg-gray-50/80'
                  }`}
                >
                  {/* Pale colored circular icon container */}
                  <div className={`w-10 h-10 rounded-full ${details.bgColor} flex items-center justify-center shrink-0 shadow-sm`}>
                    {details.icon}
                  </div>

                  {/* Message message & Timestamp */}
                  <div className="flex-grow space-y-1.5 min-w-0">
                    <p className={`text-sm leading-relaxed ${
                      !n.isRead ? 'font-bold text-[#111827]' : 'text-[#4B5563]'
                    }`}>
                      {n.message}
                    </p>
                    <span className="text-[11px] font-semibold text-[#9CA3AF] block">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Trigger */}
      {notifications.length > visibleCount && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            onClick={() => setVisibleCount((prev) => prev + 10)}
            className="w-full sm:w-auto h-11 border border-border-default hover:bg-[#F9FAFB] font-bold"
          >
            Load More Notifications
          </Button>
        </div>
      )}
    </div>
  );
};
export default NotificationsPage;
