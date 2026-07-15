import React, { useState, useEffect } from 'react';
import type { FlashSale } from '../../types/flashSale.types';
import { flashSaleApi } from '../../api/flashSale.api';
import { CountdownBadge } from './CountdownBadge';
import { DiscountBadge } from './DiscountBadge';
import { SoldProgressBar } from './SoldProgressBar';
import { CropTypeBadge } from '../ui/CropTypeBadge';
import toast from 'react-hot-toast';

interface FlashSaleClaimModalProps {
  flashSale: FlashSale;
  isOpen: boolean;
  onClose: () => void;
  onClaimed?: (claim: any) => void;
  onSuccess?: () => void;
}

export const FlashSaleClaimModal: React.FC<FlashSaleClaimModalProps> = ({
  flashSale,
  isOpen,
  onClose,
  onClaimed,
  onSuccess,
}) => {
  const [qty, setQty] = useState<number>(5);
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when modal opens/closes
    if (isOpen) {
      setQty(Math.max(5, (flashSale.listing as any)?.minimumOrderKg || 5));
      setClaim(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, flashSale]);

  if (!isOpen) return null;

  const availableKg = Math.max(0, flashSale.quantityKg - flashSale.soldKg);
  const minOrder = Math.max(5, (flashSale.listing as any)?.minimumOrderKg || 5);

  const flashPrice = flashSale.flashPricePerKg;
  const originalPrice = flashSale.originalPricePerKg;
  const total = qty * flashPrice;
  const originalTotal = qty * originalPrice;
  const savings = Math.max(0, originalTotal - total);

  // Format expiry time (e.g. 05:30 PM)
  const expiryTime = new Date(flashSale.expiresAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty < minOrder) {
      setError(`Minimum order quantity is ${minOrder}kg.`);
      return;
    }
    if (qty > availableKg) {
      setError(`Only ${availableKg}kg available to claim.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await flashSaleApi.claimFlashSale(flashSale.id, qty);
      const newClaim = res.data;
      setClaim(newClaim);
      if (onClaimed) {
        onClaimed(newClaim);
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message || '';

      if (status === 409 && msg.includes('already claimed')) {
        setError('You already have a claim on this flash sale.');
      } else if (status === 410 || msg.includes('expired')) {
        setError('This flash sale just expired. Check the marketplace for fresh listings.');
      } else if (status === 409 && (msg.includes('quantity') || msg.includes('Insufficient'))) {
        setError(`Only ${availableKg}kg remaining. Update your quantity.`);
      } else {
        setError(msg || 'Failed to secure your claim reservation. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!claim) return;
    setLoading(true);
    setError(null);
    try {
      const res = await flashSaleApi.confirmClaim(claim.id);
      toast.success('Order confirmed successfully!');
      onClose();
      // Redirect to orders page or order detail
      const order = res.data;
      if (order?.id) {
        window.location.href = `/orders/${order.id}`;
      } else {
        window.location.href = '/orders';
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to confirm reservation.');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!claim) return;
    setLoading(true);
    setError(null);
    try {
      await flashSaleApi.releaseClaim(claim.id);
      toast.success('Claim released');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to release claim.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <style>{`
        @keyframes checkmark-draw {
          to { stroke-dashoffset: 0; }
        }
        .animate-checkmark-path {
          stroke-dasharray: 80;
          stroke-dashoffset: 80;
          animation: checkmark-draw 0.5s ease-out forwards;
        }
        @keyframes modal-pop {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modal-pop {
          animation: modal-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="bg-white rounded-2xl w-full max-w-[480px] overflow-hidden border-t-[3px] border-[#DC2626] shadow-2xl animate-modal-pop flex flex-col font-sans">
        
        {/* Step 1: Claim Form */}
        {!claim ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-900 flex items-center gap-1.5 select-none">
                  Claim Flash Sale
                </h3>
                <CountdownBadge expiresAt={flashSale.expiresAt} size="sm" />
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
              {error && (
                <div className="p-3 bg-[#FEF2F2] border-l-4 border-[#DC2626] rounded text-[#B91C1C] text-xs font-bold leading-normal">
                  ⚠️ {error}
                </div>
              )}

              {/* Summary Card */}
              <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <CropTypeBadge cropType={flashSale.listing.cropType} size="sm" />
                  <span className="text-[11px] font-bold text-gray-500">
                    Farmer: {flashSale.listing.farmer?.name || 'Local Farmer'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Discount:</span>
                  <DiscountBadge
                    originalPrice={originalPrice}
                    flashPrice={flashPrice}
                    discountPercent={flashSale.discountPercent}
                    size="lg"
                  />
                </div>

                <SoldProgressBar
                  soldPercent={flashSale.soldPercent}
                  quantityKg={flashSale.quantityKg}
                  soldKg={flashSale.soldKg}
                />

                <div className="text-[11px] text-[#DC2626] font-extrabold flex items-center gap-1">
                  ⏳ Claim before: {expiryTime}
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleClaim} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="qtyInput" className="text-xs font-black text-gray-600 uppercase tracking-wider">
                    How many kg do you want to claim?
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="qtyInput"
                      type="number"
                      min={minOrder}
                      max={availableKg}
                      step={1}
                      required
                      value={qty}
                      onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
                    />
                    <span className="absolute right-4 text-sm font-bold text-gray-400 select-none">
                      kg
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-[#6B7280]">
                    Available: {availableKg}kg (Minimum order: {minOrder}kg)
                  </div>
                </div>

                {/* Pricing Box */}
                {qty >= minOrder && (
                  <div className="bg-white border-l-4 border-[#2D6A4F] border-y border-r border-gray-200 rounded-r-xl p-3 flex flex-col gap-1 shadow-sm select-none">
                    <div className="text-xs text-gray-800 font-semibold">
                      {qty} kg × GHS {flashPrice.toFixed(2)}/kg = <span className="font-extrabold text-gray-900">GHS {total.toFixed(2)}</span>
                    </div>
                    <div className="text-xs font-bold text-[#2D6A4F]">
                      🎉 You save: GHS {savings.toFixed(2)} ({flashSale.discountPercent}%)
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium line-through">
                      vs. original price: GHS {originalTotal.toFixed(2)}
                    </div>
                  </div>
                )}

                {/* Note Box */}
                <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-3 text-[11px] text-[#92400E] font-semibold leading-relaxed flex gap-2 select-none">
                  <span>⏱</span>
                  <span>Once you claim, you have 15 minutes to confirm. Unclaimed slots are released back to the pool.</span>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || availableKg <= 0}
                  className="w-full bg-[#DC2626] hover:bg-[#B91C1C] disabled:bg-gray-300 text-white font-extrabold text-sm uppercase rounded-xl transition-all duration-300 flex items-center justify-center shadow-md shadow-red-100"
                  style={{ height: '52px' }}
                >
                  {loading ? 'Claiming...' : `Claim ${qty}kg for GHS ${total.toFixed(2)}`}
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Step 2: Confirmation Panel */
          <ClaimConfirmationPanel
            claim={claim}
            cropType={flashSale.listing.cropType}
            farmerName={flashSale.listing.farmer?.name || 'Local Farmer'}
            loading={loading}
            error={error}
            onConfirm={handleConfirm}
            onRelease={handleRelease}
          />
        )}
      </div>
    </div>
  );
};

interface ClaimConfirmationPanelProps {
  claim: any;
  cropType: string;
  farmerName: string;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onRelease: () => void;
}

const ClaimConfirmationPanel: React.FC<ClaimConfirmationPanelProps> = ({
  claim,
  cropType,
  farmerName,
  loading,
  error,
  onConfirm,
  onRelease,
}) => {
  return (
    <div className="p-6 flex flex-col gap-5 text-center overflow-y-auto max-h-[85vh]">
      {error && (
        <div className="p-3 bg-[#FEF2F2] border-l-4 border-[#DC2626] rounded text-[#B91C1C] text-xs font-bold leading-normal">
          ⚠️ {error}
        </div>
      )}

      {/* SVG checkmark animation */}
      <div className="mx-auto w-16 h-16 flex items-center justify-center text-[#22C55E]">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" className="w-full h-full">
          <circle cx="26" cy="26" r="25" fill="none" stroke="#22C55E" strokeWidth="3" />
          <path
            fill="none"
            stroke="#22C55E"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 27l8 8 16-16"
            className="animate-checkmark-path"
          />
        </svg>
      </div>

      <div className="flex flex-col gap-1 select-none">
        <h4 className="text-lg font-black text-gray-900">
          You've claimed {claim.quantityKg}kg of {cropType.toLowerCase().replace('_', ' ')}!
        </h4>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirm within:</span>
          <CountdownBadge expiresAt={claim.expiresAt} size="lg" className="!bg-[#FEE2E2] !text-[#DC2626] border border-[#FECACA]" />
        </div>
      </div>

      {/* Order Preview Card */}
      <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 text-left flex flex-col gap-2.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-bold uppercase tracking-wider">Produce</span>
          <span className="font-extrabold text-gray-900 capitalize">
            {claim.quantityKg}kg {cropType.toLowerCase().replace('_', ' ')}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-bold uppercase tracking-wider">Farmer</span>
          <span className="font-extrabold text-gray-900">{farmerName}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-bold uppercase tracking-wider">Flash Price</span>
          <span className="font-extrabold text-gray-900">GHS {claim.pricePerKg.toFixed(2)}/kg</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between items-center text-sm">
          <span className="text-gray-800 font-black uppercase tracking-wider">Total Bill</span>
          <span className="font-black text-[#DC2626] text-base">GHS {claim.totalPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2.5">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full bg-[#2D6A4F] hover:bg-[#224F3B] disabled:bg-gray-300 text-white font-extrabold text-sm uppercase rounded-xl transition-all duration-300 flex items-center justify-center shadow-md shadow-green-50"
          style={{ height: '52px' }}
        >
          {loading ? 'Confirming...' : `Confirm and Pay — GHS ${claim.totalPrice.toFixed(2)}`}
        </button>

        <button
          onClick={onRelease}
          disabled={loading}
          className="w-full bg-transparent hover:bg-[#FEF2F2] text-[#DC2626] font-extrabold text-xs uppercase py-3 rounded-xl transition-all duration-300 tracking-wider flex items-center justify-center"
        >
          Release my claim
        </button>
      </div>

      <div className="text-[10px] text-gray-400 font-semibold leading-normal select-none">
        If you don't confirm in time, your claim is released to other buyers and your payment is not charged.
      </div>
    </div>
  );
};
