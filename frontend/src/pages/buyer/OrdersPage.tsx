import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { OrdersApi } from '../../api/orders.api';
import type { Order } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CropTypeBadge } from '../../components/ui/CropTypeBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusStepper } from '../../components/ui/StatusStepper';
import { RefreshCw, ShoppingBag, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

type TabStatus = 'all' | 'pending' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';

const STEP_LABELS = ['Pending', 'Confirmed', 'In Transit', 'Delivered'];

function getStepIndex(status: string): number {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'CONFIRMED':
      return 1;
    case 'IN_TRANSIT':
      return 2;
    case 'DELIVERED':
      return 3;
    case 'CANCELLED':
    default:
      return 0;
  }
}

export const OrdersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabStatus>('all');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await OrdersApi.getOrders();
      setOrders(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const getFilteredOrders = () => {
    if (activeTab === 'all') return orders;
    return orders.filter((o) => o.status.toLowerCase() === activeTab);
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div className="space-y-6 sm:space-y-8 bg-white min-h-screen">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] font-display">
            My Purchases
          </h1>
          <p className="text-sm text-text-secondary">
            Track your pending batch deliveries, confirmation steps, and transaction payments.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchOrders}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            className="flex-grow sm:flex-grow-0"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="border-b border-[#E5E7EB] bg-white flex overflow-x-auto scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6">
        {[
          { key: 'all', label: 'All Orders' },
          { key: 'pending', label: 'Pending' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'in_transit', label: 'In Transit' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabStatus)}
              className={`py-3 px-5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#2D6A4F] text-[#111827]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Orders List Container */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse flex flex-col sm:flex-row justify-between p-6 h-[120px]">
              <div className="h-12 bg-gray-200 rounded w-1/4" />
              <div className="h-12 bg-gray-200 rounded w-1/3" />
              <div className="h-12 bg-gray-200 rounded w-1/6" />
            </Card>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No orders found"
          description={
            activeTab === 'all'
              ? 'Browse the marketplace to find fresh produce listed near you.'
              : `You have no ${activeTab.replace('_', ' ')} purchases.`
          }
          icon={<ShoppingBag className="w-12 h-12 text-[#9CA3AF]" />}
          action={
            activeTab === 'all' ? (
              <Button variant="primary" onClick={() => navigate('/marketplace')}>
                Go to Marketplace
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isCancelled = order.status === 'CANCELLED';
            const isInTransit = order.status === 'IN_TRANSIT';

            return (
              <Card
                key={order.id}
                clickable
                onClick={() => navigate(`/orders/${order.id}`)}
                className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-5 gap-4 bg-white border border-[#E5E7EB] hover:border-[#2D6A4F] hover:shadow-[0_2px_8px_rgba(45,106,79,0.12)] transition-all duration-200"
              >
                {/* Left: Badge + title + quantity */}
                <div className="flex items-start gap-3.5 lg:w-1/4">
                  <div className="shrink-0 mt-0.5">
                    <CropTypeBadge cropType={order.listing?.cropType || 'OTHER'} size="sm" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-[#111827] line-clamp-1 leading-snug">
                      {order.listing?.title || (order.listing?.cropType || 'Crop').replace('_', ' ')}
                    </h4>
                    <p className="text-xs text-text-secondary">
                      Quantity: <span className="font-mono font-bold text-text-primary">{order.quantityKg} kg</span>
                    </p>
                    <div className="font-mono text-[10px] text-text-muted">
                      Batch: {order.listing?.batchCode || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Center: Stepper or Cancelled badge */}
                <div className="flex-grow flex items-center justify-center lg:px-4">
                  {isCancelled ? (
                    <div className="w-full flex items-center justify-center py-2 bg-red-50 border border-red-200/50 rounded-lg">
                      <Badge variant="error" size="md" label="Cancelled order" />
                    </div>
                  ) : (
                    <div className="w-full max-w-md bg-white border border-[#F3F4F6] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)] scale-90 sm:scale-100 origin-center">
                      <StatusStepper
                        steps={STEP_LABELS}
                        currentStep={getStepIndex(order.status)}
                        orientation="horizontal"
                      />
                    </div>
                  )}
                </div>

                {/* Right: Price + Date + View action */}
                <div className="flex items-center justify-between lg:justify-end gap-5 border-t border-[#F3F4F6] lg:border-t-0 pt-3 lg:pt-0 lg:w-1/4">
                  <div className="text-left lg:text-right space-y-1">
                    <p className="font-mono text-base font-extrabold text-[#C8960C]">
                      GHS {order.totalPrice.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">
                      Placed {new Date(order.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Live transit tracking pulsing dot */}
                    {isInTransit && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#EAF4EE] text-[#2D6A4F] border border-[#2D6A4F]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] animate-ping" />
                        <span>LIVE</span>
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Eye className="w-4 h-4" />}
                      className="px-3 py-1 min-h-0 h-9 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/orders/${order.id}`);
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
