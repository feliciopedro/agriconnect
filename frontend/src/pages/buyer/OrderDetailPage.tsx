import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { OrdersApi } from '../../api/orders.api';
import { PaymentsApi } from '../../api/payments.api';
import type { Order } from '../../types';
import { SectionCard } from '../../components/ui/SectionCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CropTypeBadge } from '../../components/ui/CropTypeBadge';
import { StatusStepper } from '../../components/ui/StatusStepper';
import { LeaveReviewModal } from '../../components/ui/LeaveReviewModal';
import { PaymentCard } from '../../components/ui/PaymentCard';
import type { PaymentCardState } from '../../components/ui/PaymentCard';
import {
  ArrowLeft,
  Send,
  Truck,
  QrCode,
  Star,
  Info,
} from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

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

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAuth(); // Enforce auth but don't bind unused user variable

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);

  // Payment flow state
  const [searchParams] = useSearchParams();
  const [paymentCardState, setPaymentCardState] = useState<PaymentCardState>('checkout');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [initializingPayment, setInitializingPayment] = useState<boolean>(false);
  const [verifyingPayment, setVerifyingPayment] = useState<boolean>(false);

  // Mock chat details
  const [messages, setMessages] = useState<{ sender: string; text: string; time: string }[]>([
    { sender: 'Farmer', text: 'Hello! I received your purchase request. I will confirm the harvest and ready the logistics soon.', time: '10 mins ago' },
  ]);
  const [chatInput, setChatInput] = useState<string>('');

  const fetchOrderDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await OrdersApi.getOrderById(id);
      setOrder(res);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load order details');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  // Detect ?payment=complete callback from Paystack / mock redirect
  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    const refParam = searchParams.get('reference') || '';
    if (paymentParam === 'complete' && id) {
      setPaymentCardState('verifying');
      setPaymentRef(refParam);
      setVerifyingPayment(true);
      PaymentsApi.verifyPayment(id)
        .then((res) => {
          if (res.verified) {
            setPaymentCardState('confirmed');
            fetchOrderDetails();
          } else {
            setPaymentCardState('pending_confirm');
          }
        })
        .catch(() => {
          setPaymentCardState('pending_confirm');
        })
        .finally(() => {
          setVerifyingPayment(false);
        });
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelOrder = async () => {
    if (!order) return;
    if (!confirm('Are you sure you want to cancel this order?')) return;

    setCancelling(true);
    try {
      await OrdersApi.cancelOrder(order.id);
      toast.success('Order cancelled successfully');
      fetchOrderDetails();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!order) return;
    setInitializingPayment(true);
    try {
      const { authorizationUrl } = await PaymentsApi.initializePayment(order.id);
      window.location.href = authorizationUrl;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to initialize payment. Please try again.');
      setInitializingPayment(false);
    }
  };

  const handleRefreshVerify = async () => {
    if (!id) return;
    setVerifyingPayment(true);
    try {
      const res = await PaymentsApi.verifyPayment(id);
      if (res.verified) {
        setPaymentCardState('confirmed');
        fetchOrderDetails();
      } else {
        toast.error('Payment not yet confirmed. Please try again shortly.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not verify payment.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setMessages([...messages, { sender: 'You', text: chatInput, time: 'Just now' }]);
    setChatInput('');
    toast.success('Message sent to farmer');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white">
        <Spinner size="lg" />
        <p className="text-text-secondary text-sm">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 bg-white">
        <p className="text-[#DC2626] font-semibold">Order not found</p>
        <Button variant="ghost" onClick={() => navigate('/orders')} className="mt-4">
          Back to Orders
        </Button>
      </div>
    );
  }

  const isPending = order.status === 'PENDING';
  const isCancelled = order.status === 'CANCELLED';
  const isDelivered = order.status === 'DELIVERED';

  const batchCode = order.listing?.batchCode || 'N/A';
  const farmerName = order.listing?.farmer?.name || 'Local Farmer';

  return (
    <div className="space-y-6 bg-white min-h-screen pb-16">
      {/* Breadcrumb & Navigation */}
      <div className="space-y-2">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>My Purchases</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] font-display">
          Order Summary
        </h1>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Header Summary */}
          <SectionCard title="Order Specifications" subtitle={`ID: ${order.id}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm text-text-secondary">
              <div className="flex items-start gap-2.5">
                <CropTypeBadge cropType={order.listing?.cropType || 'OTHER'} size="sm" />
                <div>
                  <h4 className="font-bold text-text-primary">
                    {order.listing?.title || (order.listing?.cropType || 'Produce').replace('_', ' ')}
                  </h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Batch Code: <span className="font-mono">{batchCode}</span>
                  </p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Quantity Ordered</p>
                <p className="mt-1 font-mono text-base font-bold text-text-primary">
                  {order.quantityKg} kg
                </p>
              </div>

              <div className="sm:col-span-2 border-t border-[#F3F4F6] pt-3" />

              <div>
                <p className="font-semibold text-text-primary">Transaction Value</p>
                <p className="mt-1 font-mono text-base font-bold text-[#C8960C]">
                  GHS {order.totalPrice.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Farmer Contact</p>
                <p className="mt-1 font-medium text-text-primary">{farmerName}</p>
              </div>
            </div>
          </SectionCard>

          {/* Stepper Status tracker */}
          <SectionCard title="Delivery Status Tracking" subtitle="Real-time order progress timeline.">
            {isCancelled ? (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <Info className="w-5 h-5 shrink-0" />
                <span>This purchase order has been cancelled. Restored inventory is back in listings.</span>
              </div>
            ) : (
              <div className="border border-[#F3F4F6] rounded-xl p-4 bg-white shadow-sm overflow-x-auto">
                <StatusStepper
                  steps={STEP_LABELS}
                  currentStep={getStepIndex(order.status)}
                  orientation="horizontal"
                />
              </div>
            )}
          </SectionCard>

          {/* Payment Section */}
          {order.paymentStatus === 'PAID' ? (
            /* Paid state: compact badge + reference */
            <div className="flex items-center gap-3 px-1 py-2">
              <Badge variant="success" label="Paid ✓" size="md" />
              {order.paystackReference && (
                <span className="font-mono text-xs text-[#6B7280]">
                  Ref: {order.paystackReference}
                </span>
              )}
            </div>
          ) : !isCancelled ? (
            /* Unpaid states: checkout / verifying / confirmed / pending */
            <PaymentCard
              state={paymentCardState}
              cropType={order.listing?.cropType}
              orderTotal={order.totalPrice}
              deliveryCost={
                order.deliveryRequest
                  ? order.deliveryRequest.isCarpool
                    ? order.deliveryRequest.carpoolSplitCost || 0
                    : order.deliveryRequest.estimatedCost || 0
                  : 0
              }
              isCarpool={order.deliveryRequest?.isCarpool || false}
              originalDeliveryCost={order.deliveryRequest?.estimatedCost || 0}
              reference={paymentRef}
              onProceed={handleProceedToPayment}
              onRefresh={handleRefreshVerify}
              isLoading={initializingPayment || verifyingPayment}
            />
          ) : null}

          {/* Delivery tracking information */}
          <SectionCard title="Logistics & Dispatch" subtitle="Matched transporter vehicle details.">
            <div className="p-4 bg-[#EAF4EE] border border-[#D1E7DD] rounded-xl flex items-start gap-3">
              <Truck className="w-5 h-5 text-[#2D6A4F] mt-0.5" />
              <div className="text-xs space-y-1 text-[#2D6A4F]">
                <h5 className="font-bold uppercase tracking-wider text-[10px]">
                  Fulfillment Mode
                </h5>
                <p className="font-semibold text-text-primary">
                  Delivery Mode: {order.deliveryPreference || 'FARM GATE PICKUP'}
                </p>
                {order.deliveryRequest ? (
                  <div className="space-y-1">
                    <p className="text-text-secondary">
                      Transporter matched! Distance: {order.deliveryRequest.routeDistanceKm || 'N/A'} km.
                    </p>
                    {order.deliveryRequest.isCarpool && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded font-semibold text-[10px] mt-1">
                        <span>Shared Carpool active (Saved GHS {((order.deliveryRequest.estimatedCost || 0) - (order.deliveryRequest.carpoolSplitCost || 0)).toFixed(2)})</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-text-secondary">
                    Waiting for transporter match confirmation once farmer approves the order.
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Message thread with farmer */}
          <SectionCard title="Farmer Conversation" subtitle={`Direct channel with ${farmerName}`}>
            <div className="border border-[#E5E7EB] rounded-xl flex flex-col h-[280px] bg-white overflow-hidden shadow-sm">
              {/* Message scroll list */}
              <div className="flex-grow p-4 overflow-y-auto space-y-3.5 bg-white text-xs">
                {messages.map((m, idx) => {
                  const isYou = m.sender === 'You';
                  return (
                    <div key={idx} className={`flex flex-col ${isYou ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`p-3 max-w-[80%] rounded-2xl shadow-sm ${
                          isYou
                            ? 'bg-[#2D6A4F] text-white rounded-tr-none'
                            : 'bg-white text-text-primary border border-border-default rounded-tl-none'
                        }`}
                      >
                        <p className="leading-relaxed">{m.text}</p>
                      </div>
                      <span className="text-[10px] text-text-muted mt-1 px-1">{m.time}</span>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-[#E5E7EB] flex gap-2 bg-white">
                <input
                  type="text"
                  placeholder={`Send message to ${farmerName}...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="form-input flex-grow text-xs px-3 py-2 min-h-0 h-10 border border-[#D1D5DB] rounded-lg"
                />
                <button
                  type="submit"
                  className="w-10 h-10 bg-[#2D6A4F] text-white rounded-lg flex items-center justify-center hover:bg-[#235A41] transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Order Actions panel (Sticky) */}
        <div className="space-y-6 lg:sticky lg:top-20">
          <SectionCard title="Order Actions" subtitle="Verification & Checkout operations.">
            <div className="space-y-3.5">
              {/* Cancel Order Button */}
              {isPending && (
                <Button
                  variant="ghost"
                  fullWidth
                  leftIcon={<Info className="w-4 h-4 text-[#DC2626]" />}
                  className="text-[#DC2626] hover:bg-red-50 hover:text-red-700 font-bold border-red-200 border"
                  isLoading={cancelling}
                  onClick={handleCancelOrder}
                >
                  Cancel Purchase
                </Button>
              )}

              {/* View Trace Button */}
              <Link
                to={`/trace/${batchCode}`}
                className="w-full inline-flex items-center justify-center gap-2 bg-white border border-[#E5E7EB] hover:bg-[#EAF4EE] text-[#2D6A4F] hover:text-[#235A41] font-bold py-3 rounded-lg text-sm transition-all min-h-[44px]"
              >
                <QrCode className="w-4 h-4" />
                <span>View Batch Trace</span>
              </Link>

              {/* Rate order details */}
              {isDelivered && (
                <Button
                  variant="ghost"
                  fullWidth
                  leftIcon={<Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                  onClick={() => setReviewModalOpen(true)}
                >
                  Rate this Order
                </Button>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {order && (
        <LeaveReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          toUserId={order.listing?.farmerId || ''}
          toUserName={farmerName}
          orderId={order.id}
          onSuccess={fetchOrderDetails}
        />
      )}
    </div>
  );
};

export default OrderDetailPage;
