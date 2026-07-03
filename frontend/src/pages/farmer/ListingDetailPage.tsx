import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ListingsApi } from '../../api/listings.api';
import type { DetailedListing } from '../../api/listings.api';
import api from '../../api/axios';
import { SectionCard } from '../../components/ui/SectionCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CropTypeBadge } from '../../components/ui/CropTypeBadge';
import {
  ArrowLeft,
  Copy,
  Printer,
  Edit2,
  Trash2,
  Calendar,
  MapPin,
  Leaf,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  id: string;
  buyerId: string;
  listingId: string;
  quantityKg: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  createdAt: string;
  buyer?: {
    name: string;
  };
}

export const ListingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAuth(); // Check auth but don't bind unused user

  const [listing, setListing] = useState<DetailedListing | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [qrDownloading, setQrDownloading] = useState<boolean>(false);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch listing details
      const listingData = await ListingsApi.getListingById(id);
      setListing(listingData);

      // Fetch orders and filter for this listing
      const ordersRes = await api.get('/orders');
      const filtered = (ordersRes.data?.data || []).filter(
        (o: OrderItem) => o.listingId === id
      );
      setOrders(filtered);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load listing details');
      navigate('/farmer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleCopyBatchCode = () => {
    if (!listing) return;
    navigator.clipboard.writeText(listing.batchCode);
    setCopied(true);
    toast.success('Batch code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = async () => {
    if (!listing) return;
    setQrDownloading(true);
    try {
      const blob = await ListingsApi.getListingQrCode(listing.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-${listing.batchCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('QR Code download started');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to download QR code');
    } finally {
      setQrDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!listing) return;
    if (!confirm('Are you sure you want to delete this listing? Active orders will cause it to be marked as EXPIRED instead.')) {
      return;
    }
    try {
      const res = await ListingsApi.deleteListing(listing.id);
      if (res.action === 'DELETED') {
        toast.success('Listing permanently deleted');
      } else {
        toast.success('Listing status marked as EXPIRED');
      }
      navigate('/farmer');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete listing');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white">
        <div className="w-10 h-10 border-4 border-primary-green/20 border-t-primary-green rounded-full animate-spin" />
        <p className="text-text-secondary text-sm">Loading listing details...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-20 bg-white">
        <p className="text-[#DC2626] font-semibold">Listing not found</p>
        <Button variant="ghost" onClick={() => navigate('/farmer')} className="mt-4">
          Back to Listings
        </Button>
      </div>
    );
  }

  const hasImages = listing.images && listing.images.length > 0;
  const imageList = listing.images || [];

  return (
    <div className="space-y-6 bg-white min-h-screen pb-16">
      {/* Breadcrumb & Navigation */}
      <div className="space-y-2">
        <button
          onClick={() => navigate('/farmer')}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>My Listings</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] font-display">
          Batch Details
        </h1>
      </div>

      {/* Main Grid: Left (details + carousel) | Right (sticky card actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carousel Card */}
          <SectionCard title="Produce Photos" subtitle="Photos displayed to potential wholesale buyers.">
            <div className="relative w-full h-[260px] sm:h-[360px] rounded-lg overflow-hidden bg-[#EAF4EE] border border-[#E5E7EB] flex items-center justify-center">
              {hasImages ? (
                <>
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/../${imageList[activeImageIdx]}`}
                    alt="Produce"
                    className="w-full h-full object-cover"
                  />
                  {imageList.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setActiveImageIdx((prev) => (prev === 0 ? imageList.length - 1 : prev - 1))
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() =>
                          setActiveImageIdx((prev) => (prev === imageList.length - 1 ? 0 : prev + 1))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/35 px-2.5 py-1 rounded-full">
                        {imageList.map((_: string, idx: number) => (
                          <div
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full ${
                              idx === activeImageIdx ? 'bg-white' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 select-none">
                  <Leaf className="w-12 h-12 text-[#2D6A4F]" />
                  <span className="text-xs text-[#6B7280]">No images provided for this batch</span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Listing Details Card */}
          <SectionCard title="Listing Overview" subtitle="General inventory and agricultural properties.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm text-text-secondary">
              <div>
                <p className="font-semibold text-text-primary">Crop Type</p>
                <div className="mt-1 flex items-center gap-2">
                  <CropTypeBadge cropType={listing.cropType} />
                  <Badge
                    variant={
                      listing.status === 'AVAILABLE'
                        ? 'success'
                        : listing.status === 'RESERVED'
                        ? 'info'
                        : 'neutral'
                    }
                    label={listing.status}
                  />
                </div>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Batch Title</p>
                <p className="mt-1 font-medium text-text-primary">{listing.title || 'N/A'}</p>
              </div>

              <div className="border-t border-[#E5E7EB] pt-4 sm:col-span-2" />

              <div>
                <p className="font-semibold text-text-primary">Quantity (Available / Total)</p>
                <p className="mt-1 text-base font-bold text-text-primary">
                  {listing.remainingKg} kg / {listing.quantityKg} kg
                </p>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Price</p>
                <p className="mt-1 font-mono text-base font-bold text-[#C8960C]">
                  GHS {listing.pricePerKg.toFixed(2)} / kg
                </p>
              </div>

              <div className="border-t border-[#E5E7EB] pt-4 sm:col-span-2" />

              <div>
                <p className="font-semibold text-text-primary">Harvest Date</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#9CA3AF]" />
                  <span>{new Date(listing.harvestDate).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Estimated Expiry</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#9CA3AF]" />
                  <span>
                    {listing.expiryEstimate
                      ? new Date(listing.expiryEstimate).toLocaleDateString()
                      : 'Not specified'}
                  </span>
                </div>
              </div>

              <div className="border-t border-[#E5E7EB] pt-4 sm:col-span-2" />

              {/* Traceability/Growing details */}
              <div>
                <p className="font-semibold text-text-primary">Inputs Used</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {listing.traceability?.inputsUsed && listing.traceability.inputsUsed.length > 0 ? (
                    listing.traceability.inputsUsed.map((i, idx) => (
                      <Badge key={idx} variant="primary" label={i} />
                    ))
                  ) : (
                    <span className="text-xs italic text-[#9CA3AF]">None reported</span>
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Planting Date</p>
                <p className="mt-1">
                  {listing.traceability?.plantingDate
                    ? new Date(listing.traceability.plantingDate).toLocaleDateString()
                    : 'Not reported'}
                </p>
              </div>

              <div className="border-t border-[#E5E7EB] pt-4 sm:col-span-2" />

              <div className="sm:col-span-2">
                <p className="font-semibold text-text-primary">Fulfillment Location</p>
                <div className="mt-1.5 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-[#DC2626] mt-0.5" />
                  <div>
                    <p className="font-medium text-text-primary">
                      {listing.farmer?.district || 'District not specified'},{' '}
                      {listing.farmer?.region || 'Region not specified'}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      Coordinates: {listing.latitude.toFixed(6)}, {listing.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Orders Table */}
          <SectionCard title="Inbound Batch Orders" subtitle="Buyer transactions reserved for this batch.">
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs italic text-[#9CA3AF]">No orders received for this batch yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:-mx-5 border-t border-[#E5E7EB]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                      <th className="p-3 font-semibold text-text-primary">Buyer</th>
                      <th className="p-3 font-semibold text-text-primary">Qty</th>
                      <th className="p-3 font-semibold text-text-primary">Value</th>
                      <th className="p-3 font-semibold text-text-primary">Status</th>
                      <th className="p-3 font-semibold text-text-primary">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-text-primary">
                          {order.buyer?.name || 'Unknown Buyer'}
                        </td>
                        <td className="p-3 font-mono">{order.quantityKg} kg</td>
                        <td className="p-3 font-mono font-semibold text-text-primary">
                          GHS {order.totalPrice.toFixed(2)}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              order.status === 'DELIVERED'
                                ? 'success'
                                : order.status === 'PENDING'
                                ? 'warning'
                                : order.status === 'CANCELLED'
                                ? 'error'
                                : 'info'
                            }
                            label={order.status}
                            size="sm"
                          />
                        </td>
                        <td className="p-3 text-[#9CA3AF]">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column: Sticky Actions Box */}
        <div className="space-y-6 lg:sticky lg:top-20">
          <SectionCard title="Batch Tracking" subtitle="Traceability Ledger & Actions">
            <div className="space-y-5">
              {/* Batch Code display & Copy */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Batch Code
                </p>
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-[#E5E7EB] rounded-card justify-between">
                  <span className="font-mono text-base font-bold text-text-primary tracking-wide">
                    {listing.batchCode}
                  </span>
                  <button
                    onClick={handleCopyBatchCode}
                    className="p-1.5 text-text-secondary hover:text-primary transition-colors bg-white rounded-md border border-[#E5E7EB] hover:border-primary"
                  >
                    {copied ? (
                      <ClipboardCheck className="w-4 h-4 text-[#2D6A4F]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Quality Grade Card info */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Quality Assessment
                </p>
                <div className="flex items-center justify-between p-3 bg-[#FEF9EC] border border-[#FDE9C8] rounded-card">
                  <div>
                    <span className="text-[11px] text-[#A16207] uppercase font-bold tracking-wide block">
                      Grade Classification
                    </span>
                    <span className="text-[11px] text-[#A16207] font-semibold">
                      {listing.qualityGradeSource === 'AI' ? '✓ AI Assessed' : 'Manually Set'}
                    </span>
                  </div>
                  <Badge variant="warning" size="md" label={`Grade ${listing.qualityGrade}`} />
                </div>
              </div>

              {/* QR Code trigger */}
              <Button
                variant="secondary"
                fullWidth
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={handleDownloadQr}
                isLoading={qrDownloading}
              >
                Download QR Code
              </Button>

              <div className="border-t border-[#E5E7EB] pt-4 flex flex-col gap-2">
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<Edit2 className="w-4 h-4" />}
                  onClick={() => navigate(`/farmer/listings/edit/${listing.id}`)}
                >
                  Edit Listing
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  leftIcon={<Trash2 className="w-4 h-4 text-[#DC2626]" />}
                  className="text-[#DC2626] hover:bg-red-50 hover:text-red-700"
                  onClick={handleDelete}
                >
                  Delete Listing
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default ListingDetailPage;
