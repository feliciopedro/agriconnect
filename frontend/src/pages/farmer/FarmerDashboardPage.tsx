import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ListingsApi } from '../../api/listings.api';
import api from '../../api/axios';
import type { ProduceListing } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CropTypeBadge } from '../../components/ui/CropTypeBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Plus,
  Leaf,
  Calendar,
  Trash2,
  Edit2,
  RefreshCw,
  Clock,
  Package,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const FarmerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'active' | 'sold_out' | 'all'>('active');

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch Farmer's listings
      const listingsRes = await ListingsApi.getListings({ farmerId: user.id });
      setListings(listingsRes.data || []);

      // Fetch pending orders count
      const ordersRes = await api.get('/orders', {
        params: { status: 'PENDING', limit: 1 },
      });
      setPendingOrdersCount(ordersRes.data?.total || 0);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid card click navigation
    if (!confirm('Are you sure you want to delete this listing? Active orders will cause it to be marked as EXPIRED instead.')) {
      return;
    }
    try {
      const res = await ListingsApi.deleteListing(id);
      if (res.action === 'DELETED') {
        toast.success('Listing permanently deleted');
      } else {
        toast.success('Listing status marked as EXPIRED');
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete listing');
    }
  };

  // Filter listings based on active tab
  const getFilteredListings = () => {
    switch (activeTab) {
      case 'active':
        // AVAILABLE or RESERVED status are active
        return listings.filter((l) => l.status === 'AVAILABLE' || l.status === 'RESERVED');
      case 'sold_out':
        return listings.filter((l) => l.status === 'SOLD_OUT');
      case 'all':
      default:
        return listings;
    }
  };

  // Stats calculation
  const activeListingsCount = listings.filter(
    (l) => l.status === 'AVAILABLE' || l.status === 'RESERVED'
  ).length;

  const totalKgListed = listings
    .filter((l) => l.status === 'AVAILABLE' || l.status === 'RESERVED')
    .reduce((acc, curr) => acc + curr.remainingKg, 0);

  const filteredListings = getFilteredListings();

  return (
    <div className="space-y-6 sm:space-y-8 bg-white min-h-screen">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] font-display">
            My Listings
          </h1>
          <p className="text-sm text-text-secondary">
            Manage your produce batches, track buyer orders, and monitor quality grades.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            className="flex-grow sm:flex-grow-0"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/farmer/listings/new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="flex-grow sm:flex-grow-0"
          >
            New Listing
          </Button>
        </div>
      </div>

      {/* Summary strip - 3 stat cards in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <Card accentColor="#2D6A4F" className="flex items-center justify-between p-5">
          <div>
            <p className="text-[#6B7280] text-[13px] font-medium">Active Listings</p>
            <h3 className="font-mono text-[28px] font-bold text-[#111827] mt-1">
              {loading ? '...' : activeListingsCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#EAF4EE] flex items-center justify-center text-primary">
            <TrendingUp className="w-5 h-5 text-[#2D6A4F]" />
          </div>
        </Card>

        <Card accentColor="#2D6A4F" className="flex items-center justify-between p-5">
          <div>
            <p className="text-[#6B7280] text-[13px] font-medium">Total kg Listed</p>
            <h3 className="font-mono text-[28px] font-bold text-[#111827] mt-1">
              {loading ? '...' : `${totalKgListed.toLocaleString()} kg`}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#EAF4EE] flex items-center justify-center text-primary">
            <Package className="w-5 h-5 text-[#2D6A4F]" />
          </div>
        </Card>

        <Card accentColor="#2D6A4F" className="flex items-center justify-between p-5">
          <div>
            <p className="text-[#6B7280] text-[13px] font-medium">Pending Orders</p>
            <h3 className="font-mono text-[28px] font-bold text-[#111827] mt-1">
              {loading ? '...' : pendingOrdersCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#EAF4EE] flex items-center justify-center text-primary">
            <Clock className="w-5 h-5 text-[#2D6A4F]" />
          </div>
        </Card>
      </div>

      {/* Tab bar below the summary */}
      <div className="border-b border-[#E5E7EB] bg-white flex">
        <button
          onClick={() => setActiveTab('active')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-[#2D6A4F] text-[#111827]'
              : 'border-transparent text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab('sold_out')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'sold_out'
              ? 'border-[#2D6A4F] text-[#111827]'
              : 'border-transparent text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          Sold Out
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-[#2D6A4F] text-[#111827]'
              : 'border-transparent text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          All
        </button>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse flex flex-col space-y-4 h-[350px]">
              <div className="w-full h-[160px] bg-gray-200 rounded-t-[10px] -mx-4 -mt-4 sm:-mx-5 sm:-mt-5" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-6 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : filteredListings.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="List your first batch of produce so buyers can find you"
          icon={<Leaf className="w-12 h-12 text-[#2D6A4F]" />}
          action={
            <Button
              variant="primary"
              onClick={() => navigate('/farmer/listings/new')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Listing
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => {
            const hasImage = listing.images && listing.images.length > 0;
            const imageUrl = hasImage
              ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/../${listing.images[0]}`
              : null;

            // Treat EXPIRED status with 0 orders as a Draft
            const isDraft = listing.status === 'EXPIRED'; // soft delete or draft

            return (
              <Card
                key={listing.id}
                clickable
                onClick={() => navigate(`/farmer/listings/${listing.id}`)}
                className="flex flex-col h-full bg-white group overflow-hidden border border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:border-[#2D6A4F] hover:shadow-[0_2px_8px_rgba(45,106,79,0.12)] transition-all duration-200"
              >
                {/* Image / Placeholder */}
                <div className="relative w-full h-[160px] bg-[#EAF4EE] -mx-4 -mt-4 sm:-mx-5 sm:-mt-5 overflow-hidden flex items-center justify-center border-b border-[#E5E7EB]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={listing.cropType}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 rounded-t-[10px]"
                      onError={(e) => {
                        // fallback if image fails to load
                        (e.target as HTMLImageElement).src = '';
                        (e.target as HTMLImageElement).className = 'hidden';
                      }}
                    />
                  ) : null}
                  {!imageUrl && (
                    <div className="flex flex-col items-center gap-1.5 select-none">
                      <Leaf className="w-10 h-10 text-[#2D6A4F]" />
                    </div>
                  )}
                </div>

                {/* Body Content */}
                <div className="flex-grow pt-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    {/* Row 1: CropTypeBadge + status badge */}
                    <div className="flex items-center justify-between">
                      <CropTypeBadge cropType={listing.cropType} size="sm" />
                      {isDraft ? (
                        <Badge variant="warning" size="sm" label="Draft / Expired" />
                      ) : (
                        <Badge
                          variant={
                            listing.status === 'AVAILABLE'
                              ? 'success'
                              : listing.status === 'RESERVED'
                              ? 'info'
                              : 'neutral'
                          }
                          size="sm"
                          label={listing.status}
                        />
                      )}
                    </div>

                    {/* Crop name */}
                    <h4 className="text-base font-semibold text-[#111827] line-clamp-1">
                      {listing.title || listing.cropType.replace('_', ' ')}
                    </h4>

                    {/* Price in Gold */}
                    <p className="font-mono text-[18px] font-bold text-[#C8960C]">
                      GHS {listing.pricePerKg.toFixed(2)} / kg
                    </p>

                    {/* Quantity remaining */}
                    <p className="text-[13px] text-[#6B7280]">
                      {listing.remainingKg} / {listing.quantityKg} kg remaining
                    </p>

                    {/* Harvest Date */}
                    <div className="flex items-center gap-1 text-[12px] text-[#9CA3AF]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Harvested: {new Date(listing.harvestDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Batch code */}
                    <div className="font-mono text-[11px] text-[#9CA3AF] truncate">
                      Batch: {listing.batchCode}
                    </div>
                  </div>

                  {/* Card Footer actions */}
                  <div className="flex items-center justify-between border-t border-[#E5E7EB] mt-4 pt-3 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      className="px-2 min-h-0 py-1 h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/farmer/listings/edit/${listing.id}`);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />}
                      className="px-2 min-h-0 py-1 h-8 text-[#DC2626] hover:bg-red-50 hover:text-red-700"
                      onClick={(e) => handleDelete(listing.id, e)}
                    >
                      Delete
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

export default FarmerDashboardPage;
