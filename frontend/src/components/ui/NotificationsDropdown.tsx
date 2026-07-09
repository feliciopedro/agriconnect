import React from 'react';
import { ShoppingBag, Truck, MessageSquare, Settings } from 'lucide-react';
import type { Notification } from '../../api/notifications.api';
import { formatRelativeTime } from './NotificationBell';

interface NotificationsDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  markAllReadLoading: boolean;
  onNotificationClick: (n: Notification) => void;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  notifications,
  unreadCount,
  onMarkAllRead,
  markAllReadLoading,
  onNotificationClick,
}) => {
  const getNotificationDetails = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ORDER':
        return {
          icon: <ShoppingBag size={15} className="text-[#2D6A4F]" />,
          bgColor: 'bg-[#EAF4EE]',
        };
      case 'DELIVERY':
        return {
          icon: <Truck size={15} className="text-[#C8960C]" />,
          bgColor: 'bg-[#FEF9EC]',
        };
      case 'MESSAGE':
      case 'NEW_MESSAGE':
        return {
          icon: <MessageSquare size={15} className="text-[#1D4ED8]" />,
          bgColor: 'bg-[#EFF6FF]',
        };
      default:
        return {
          icon: <Settings size={15} className="text-[#4B5563]" />,
          bgColor: 'bg-[#F3F4F6]',
        };
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-[#EAF4EE]/20">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-800 text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-[#DC2626] text-white text-xs px-2 py-0.5 rounded-full font-semibold">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            disabled={markAllReadLoading}
            className="text-xs font-semibold text-[#2D6A4F] hover:text-[#235A41] disabled:opacity-50 cursor-pointer"
          >
            {markAllReadLoading ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <Settings size={18} className="text-gray-400" />
            </div>
            <p className="text-xs text-gray-500 font-medium">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => {
            const { icon, bgColor } = getNotificationDetails(n.type);
            return (
              <div
                key={n.id}
                onClick={() => onNotificationClick(n)}
                className={`flex gap-3 p-3.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                  !n.isRead ? 'bg-[#2D6A4F]/5' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center shrink-0`}>
                  {icon}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <p className={`text-xs text-gray-700 leading-normal ${!n.isRead ? 'font-semibold' : ''}`}>
                    {n.message}
                  </p>
                  <span className="text-[10px] text-gray-400 font-medium block">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
                {!n.isRead && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0 mt-1.5" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsDropdown;
