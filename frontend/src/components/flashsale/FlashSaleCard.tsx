import React, { useState } from 'react';
import type { FlashSale } from '../../types/flashSale.types';
import { CountdownBadge } from './CountdownBadge';
import { DiscountBadge } from './DiscountBadge';
import { SoldProgressBar } from './SoldProgressBar';
import { FlashSaleClaimModal } from './FlashSaleClaimModal';

interface FlashSaleCardProps {
  flashSale: FlashSale;
  onSuccess?: () => void;
}

export const FlashSaleCard: React.FC<FlashSaleCardProps> = ({ flashSale, onSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const availableKg = Math.max(0, flashSale.quantityKg - flashSale.soldKg);
  const distanceKm = (flashSale as any).distance_km;
  const locationLabel = distanceKm !== undefined
    ? `~${Math.round(distanceKm)}km away`
    : flashSale.listing.farmer?.name
    ? 'Eastern Region'
    : 'Local';

  const defaultImage = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop';
  const imageUrl = flashSale.listing.images?.[0] || defaultImage;

  return (
    <div className="bg-white rounded-2xl border-2 border-[#DC2626] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col w-full">
      {/* Top red strip */}
      <div className="bg-[#DC2626] px-3 py-1.5 flex items-center justify-between text-white select-none">
        <span className="text-[11px] font-black uppercase tracking-wider">
          🔥 FLASH SALE
        </span>
        <CountdownBadge expiresAt={flashSale.expiresAt} size="sm" className="!bg-white/10 !text-white" />
      </div>

      {/* Image */}
      <div className="w-full h-[120px] overflow-hidden bg-gray-100 relative">
        <img
          src={imageUrl}
          alt={flashSale.listing.cropType}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
        {/* Urgent overlay if quantity is low */}
        {availableKg > 0 && availableKg < 20 && (
          <span className="absolute top-2 left-2 bg-[#DC2626] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
            Selling Fast
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex-grow flex flex-col gap-3">
        {/* Row 1: Crop and Location */}
        <div className="flex justify-between items-start">
          <span className="bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
            {flashSale.listing.cropType.replace('_', ' ')}
          </span>
          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            📍 {locationLabel}
          </span>
        </div>

        {/* Row 2: Farmer profile */}
        <div className="text-xs text-[#4B5563] font-medium">
          Farmer: <span className="font-bold text-gray-900">{flashSale.listing.farmer?.name || 'Local Farmer'}</span>
        </div>

        {/* Row 3: Prices */}
        <DiscountBadge
          originalPrice={flashSale.originalPricePerKg}
          flashPrice={flashSale.flashPricePerKg}
          discountPercent={flashSale.discountPercent}
        />

        {/* Row 4: Progress Bar */}
        <SoldProgressBar
          soldPercent={flashSale.soldPercent}
          quantityKg={flashSale.quantityKg}
          soldKg={flashSale.soldKg}
        />

        {/* Row 5: Available Status */}
        <div className="mt-1 text-xs">
          {availableKg < 20 ? (
            <span className="font-black text-[#DC2626] animate-pulse">
              🚨 Only {availableKg}kg left!
            </span>
          ) : (
            <span className="font-semibold text-gray-700">
              📦 {availableKg}kg available
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 pt-0">
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={availableKg <= 0 || new Date(flashSale.expiresAt).getTime() <= Date.now()}
          className="w-full bg-[#DC2626] hover:bg-[#B91C1C] disabled:bg-gray-300 text-white font-extrabold text-xs uppercase py-2.5 rounded-xl transition-all duration-300 tracking-wider shadow-md shadow-red-50 hover:shadow-red-100 flex items-center justify-center gap-1.5"
        >
          Claim Now
        </button>
      </div>

      <FlashSaleClaimModal
        flashSale={flashSale}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={onSuccess}
      />
    </div>
  );
};

export default FlashSaleCard;
