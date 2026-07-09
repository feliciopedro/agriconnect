import React from 'react';
import {
  Lock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Spinner } from './Spinner';
import { Button } from './Button';

// ─── Payment method logos (inline SVG / text badges) ────────────────────────

const MomoLogo: React.FC = () => (
  <div className="flex items-center justify-center w-10 h-6 rounded bg-gray-100 border border-gray-200">
    <span className="text-[9px] font-black text-gray-400 leading-none tracking-tight">MTN</span>
  </div>
);

const VodafoneLogo: React.FC = () => (
  <div className="flex items-center justify-center w-10 h-6 rounded bg-gray-100 border border-gray-200">
    <span className="text-[9px] font-black text-gray-400 leading-none tracking-tight">VODA</span>
  </div>
);

const AirtelLogo: React.FC = () => (
  <div className="flex items-center justify-center w-10 h-6 rounded bg-gray-100 border border-gray-200">
    <span className="text-[9px] font-black text-gray-400 leading-none tracking-tight">ATM</span>
  </div>
);

const VisaLogo: React.FC = () => (
  <div className="flex items-center justify-center w-10 h-6 rounded bg-gray-100 border border-gray-200">
    <span className="text-[9px] font-black text-gray-400 leading-none italic tracking-tight">VISA</span>
  </div>
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentCardState = 'checkout' | 'verifying' | 'confirmed' | 'pending_confirm';

interface PaymentCardProps {
  state: PaymentCardState;
  cropType?: string;
  orderTotal?: number;
  deliveryCost?: number;
  isCarpool?: boolean;
  originalDeliveryCost?: number;
  reference?: string;
  onProceed?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// ─── Sub-states ──────────────────────────────────────────────────────────────

/** Full-page centered spinner while verifying payment. */
const VerifyingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-14 gap-4 bg-white rounded-card border border-border">
    <Spinner size="lg" color="#C8960C" />
    <p className="text-sm font-semibold text-text-secondary">Confirming your payment…</p>
  </div>
);

/** Green-border success card. */
const ConfirmedState: React.FC<{ orderTotal?: number; reference?: string }> = ({
  orderTotal = 0,
  reference = '',
}) => (
  <div
    className="bg-white rounded-card border border-border p-5 space-y-3"
    style={{ borderTop: '3px solid #2D6A4F' }}
  >
    <div className="flex items-center gap-3">
      <CheckCircle className="w-8 h-8 text-[#2D6A4F] shrink-0" />
      <div>
        <h3 className="text-base font-bold text-[#111827]">Payment Confirmed</h3>
        <p className="font-mono text-sm text-[#6B7280] mt-0.5">
          GHS {orderTotal.toFixed(2)} paid · Ref: {reference}
        </p>
      </div>
    </div>
  </div>
);

/** Amber-border pending confirmation card. */
const PendingConfirmState: React.FC<{ onRefresh?: () => void; isLoading?: boolean }> = ({
  onRefresh,
  isLoading,
}) => (
  <div
    className="bg-white rounded-card border border-border p-5 space-y-3"
    style={{ borderTop: '3px solid #D97706' }}
  >
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-6 h-6 text-[#D97706] shrink-0 mt-0.5" />
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-[#111827]">Payment Pending Confirmation</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          If you completed the payment, it may take a moment to appear. Try refreshing.
        </p>
      </div>
    </div>
    <Button
      variant="secondary"
      size="sm"
      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
      isLoading={isLoading}
      onClick={onRefresh}
    >
      Refresh
    </Button>
  </div>
);

/** Full checkout payment summary card. */
const CheckoutState: React.FC<{
  cropType?: string;
  orderTotal?: number;
  deliveryCost?: number;
  isCarpool?: boolean;
  originalDeliveryCost?: number;
  onProceed?: () => void;
  isLoading?: boolean;
}> = ({
  cropType = 'Produce',
  orderTotal = 0,
  deliveryCost = 0,
  isCarpool = false,
  originalDeliveryCost = 0,
  onProceed,
  isLoading,
}) => {
  const grandTotal = orderTotal + deliveryCost;
  const cropLabel = cropType.replace(/_/g, ' ');

  return (
    <div
      className="bg-white rounded-card border border-border p-5 space-y-5"
      style={{ borderTop: '3px solid #C8960C' }}
    >
      {/* Title */}
      <h3 className="text-base font-bold text-[#111827]">Complete Payment</h3>

      {/* Line items */}
      <div className="space-y-2 text-sm">
        {/* Produce row */}
        <div className="flex items-center justify-between text-text-secondary">
          <span>Produce ({cropLabel})</span>
          <span className="font-medium text-text-primary">GHS {orderTotal.toFixed(2)}</span>
        </div>

        {/* Delivery row */}
        <div className="flex items-center justify-between text-text-secondary">
          <span>
            {isCarpool ? 'Delivery (Shared Carpool)' : 'Est. delivery'}
          </span>
          <span className={`font-medium ${isCarpool ? 'text-[#2D6A4F]' : 'text-text-primary'}`}>
            {deliveryCost > 0 ? `GHS ${deliveryCost.toFixed(2)}` : 'GHS 0.00'}
          </span>
        </div>

        {isCarpool && originalDeliveryCost > deliveryCost && (
          <div className="flex items-center justify-between text-emerald-800 text-[11px] bg-emerald-50 border border-emerald-100 p-2 rounded-lg font-semibold">
            <span>Carpool Split Savings</span>
            <span>-GHS {(originalDeliveryCost - deliveryCost).toFixed(2)}</span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[#E5E7EB] pt-2 flex items-center justify-between">
          <span className="font-semibold text-[#111827]">Total due</span>
          <span className="font-mono font-bold text-[#111827] text-base">
            GHS {grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Payment method logos */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <MomoLogo />
          <VodafoneLogo />
          <AirtelLogo />
          <VisaLogo />
        </div>
        <p className="text-[10px] text-text-muted font-medium flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" />
          Secure payment by Paystack
        </p>
      </div>

      {/* CTA button */}
      <button
        onClick={onProceed}
        disabled={isLoading}
        style={{ height: '52px', backgroundColor: isLoading ? '#E5E7EB' : '#C8960C' }}
        className="w-full flex items-center justify-center gap-2 text-white font-bold rounded-btn text-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:text-[#9CA3AF] select-none"
      >
        {isLoading ? (
          <>
            <Spinner size="sm" color="#9CA3AF" />
            <span>Redirecting…</span>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            <span>Proceed to Payment — GHS {grandTotal.toFixed(2)}</span>
          </>
        )}
      </button>
    </div>
  );
};

// ─── Main export ─────────────────────────────────────────────────────────────

export const PaymentCard: React.FC<PaymentCardProps> = ({
  state,
  cropType,
  orderTotal,
  deliveryCost,
  isCarpool,
  originalDeliveryCost,
  reference,
  onProceed,
  onRefresh,
  isLoading,
}) => {
  switch (state) {
    case 'verifying':
      return <VerifyingState />;
    case 'confirmed':
      return <ConfirmedState orderTotal={orderTotal} reference={reference} />;
    case 'pending_confirm':
      return <PendingConfirmState onRefresh={onRefresh} isLoading={isLoading} />;
    case 'checkout':
    default:
      return (
        <CheckoutState
          cropType={cropType}
          orderTotal={orderTotal}
          deliveryCost={deliveryCost}
          isCarpool={isCarpool}
          originalDeliveryCost={originalDeliveryCost}
          onProceed={onProceed}
          isLoading={isLoading}
        />
      );
  }
};

export default PaymentCard;
