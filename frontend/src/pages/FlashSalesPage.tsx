import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { flashSaleApi } from '../api/flashSale.api';
import type { FlashSale } from '../types/flashSale.types';
import { FlashSaleCard } from '../components/flashsale/FlashSaleCard';

export const FlashSalesPage: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState<string>('ALL');
  const [maxDistance, setMaxDistance] = useState<number>(50);
  const [sortBy, setSortBy] = useState<'expiry' | 'discount'>('expiry');
  const [toast, setToast] = useState<{ message: string; id: string } | null>(null);

  const fetchSales = async (isPoll = false) => {
    try {
      const params: any = {};
      if (user?.latitude !== undefined && user?.longitude !== undefined) {
        params.latitude = user.latitude;
        params.longitude = user.longitude;
        params.radiusKm = maxDistance;
      }
      
      const res = await flashSaleApi.getActiveFlashSales(params);
      const newSalesList: FlashSale[] = res.data;

      // Check for new sales
      if (isPoll && sales.length > 0) {
        const prevIds = new Set(sales.map(s => s.id));
        const newlyAdded = newSalesList.find(s => !prevIds.has(s.id));
        if (newlyAdded) {
          const cropName = newlyAdded.listing.cropType.toLowerCase().replace('_', ' ');
          setToast({
            message: `New flash sale! ${cropName} near you — ${newlyAdded.discountPercent}% off`,
            id: newlyAdded.id,
          });
          setTimeout(() => setToast(null), 6000);
        }
      }

      setSales(newSalesList);
    } catch (err) {
      console.error('Failed to load flash sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    const interval = setInterval(() => fetchSales(true), 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [user, maxDistance]);

  const filteredSales = sales
    .filter((fs) => {
      if (selectedCrop !== 'ALL' && fs.listing.cropType !== selectedCrop) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'expiry') {
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      } else {
        return b.discountPercent - a.discountPercent;
      }
    });

  const crops = ['ALL', 'TOMATO', 'PEPPER', 'GARDEN_EGG', 'OKRA', 'LEAFY_GREENS'];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1E293B] text-white px-4 py-3 rounded-2xl shadow-2xl border border-gray-700 flex items-center gap-3 animate-slide-in">
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-slide-in {
              animation: slideIn 0.3s ease-out forwards;
            }
          `}</style>
          <span className="text-sm font-semibold">{toast.message}</span>
          <button
            onClick={() => {
              const element = document.getElementById(toast.id);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
              setToast(null);
            }}
            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-300"
          >
            View
          </button>
        </div>
      )}

      {/* Header and Live Chip */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-2">
            Flash Sales
          </h1>
          <span className="bg-[#FEE2E2] text-[#DC2626] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider select-none animate-pulse">
            {sales.length} active now
          </span>
        </div>
      </div>

      {/* Explainer Card */}
      <div className="bg-white border border-[#FDE047] rounded-2xl p-4 md:p-5 mb-6 shadow-sm flex items-start gap-3 select-none">
        <span className="text-2xl text-[#EAB308]">💡</span>
        <div>
          <h4 className="text-sm font-extrabold text-gray-900 mb-0.5">Flash Sale Rules</h4>
          <p className="text-xs text-[#4B5563] leading-relaxed font-medium">
            Flash sales are discounted produce nearing its expiry window.
            Claim a batch within the time limit to lock in the price.
            You have 15 minutes to confirm after claiming.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 shadow-sm flex flex-col gap-4">
        {/* Crop Chips */}
        <div className="flex flex-wrap gap-2">
          {crops.map((crop) => (
            <button
              key={crop}
              onClick={() => setSelectedCrop(crop)}
              className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all duration-300 select-none ${
                selectedCrop === crop
                  ? 'bg-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/10'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
              }`}
            >
              {crop.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Sliders / Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Distance Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Distance</span>
              <select
                value={maxDistance}
                onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              >
                <option value={10}>Within 10 km</option>
                <option value={25}>Within 25 km</option>
                <option value={50}>Within 50 km</option>
                <option value={100}>Within 100 km</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent"
              >
                <option value="expiry">Expiring soonest</option>
                <option value="discount">Biggest discount</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[#6B7280] font-semibold">
          Loading flash sales...
        </div>
      ) : filteredSales.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredSales.map((fs) => (
            <div id={fs.id} key={fs.id}>
              <FlashSaleCard flashSale={fs} onSuccess={fetchSales} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-[#9CA3AF]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <h3 className="text-md font-bold text-gray-900">No Flash Sales Right Now</h3>
          <p className="text-xs text-[#6B7280] max-w-sm leading-relaxed font-medium">
            Check back soon — new flash sales appear when farmers have produce nearing its freshness window.
          </p>
        </div>
      )}
    </div>
  );
};

export default FlashSalesPage;
