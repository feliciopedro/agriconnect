import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FlashSale } from '../../types/flashSale.types';
import { flashSaleApi } from '../../api/flashSale.api';
import { FlashSaleCard } from './FlashSaleCard';

interface FlashSalesStripProps {
  buyerLatitude?: number;
  buyerLongitude?: number;
}

export const FlashSalesStrip: React.FC<FlashSalesStripProps> = ({
  buyerLatitude,
  buyerLongitude,
}) => {
  const [sales, setSales] = useState<FlashSale[]>([]);

  const fetchSales = async () => {
    try {
      const params: any = {};
      if (buyerLatitude !== undefined && buyerLongitude !== undefined) {
        params.latitude = buyerLatitude;
        params.longitude = buyerLongitude;
        params.radiusKm = 25;
      }
      const res = await flashSaleApi.getActiveFlashSales(params);
      setSales(res.data);
    } catch (err) {
      console.error('Failed to load flash sales for strip:', err);
    }
  };

  useEffect(() => {
    fetchSales();
    const interval = setInterval(fetchSales, 60000); // Poll every 60s
    return () => clearInterval(interval);
  }, [buyerLatitude, buyerLongitude]);

  if (sales.length === 0) return null;

  return (
    <div className="w-full bg-[#FFF5F5] border border-[#FEE2E2] rounded-2xl p-4 md:p-6 mb-6 flex flex-col gap-4">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.5; }
        }
        .animate-pulse-dot {
          animation: pulse-dot 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* Header Row */}
      <div className="flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          {/* Pulsing red dot */}
          <span className="relative flex h-3 w-3">
            <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#DC2626]"></span>
          </span>
          <h2 className="text-base md:text-lg font-black text-[#DC2626] uppercase tracking-wide">
            Flash Sales
          </h2>
        </div>
        <Link
          to="/flash-sales"
          className="text-xs md:text-sm font-bold text-[#DC2626] hover:text-[#B91C1C] transition-colors flex items-center gap-1 group"
        >
          View all
          <svg className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>

      {/* Scrollable Row */}
      <div className="flex gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar snap-x snap-mandatory font-sans">
        {sales.map((fs) => (
          <div
            key={fs.id}
            className="w-[80%] min-w-[270px] snap-center flex-shrink-0 md:w-[calc(33.33%-11px)] md:snap-start"
          >
            <FlashSaleCard flashSale={fs} onSuccess={fetchSales} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlashSalesStrip;
