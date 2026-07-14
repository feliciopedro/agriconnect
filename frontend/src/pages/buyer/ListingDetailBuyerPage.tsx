import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ListingsApi } from '../../api/listings.api';
import type { DetailedListing } from '../../api/listings.api';
import { OrdersApi } from '../../api/orders.api';
import { CoOpApi, type CoOpGroup } from '../../api/coop.api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CropTypeBadge } from '../../components/ui/CropTypeBadge';
import { UserReviewsPanel } from '../../components/ui/UserReviewsPanel';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Leaf,
  ChevronLeft,
  ChevronRight,
  Star,
  MessageCircle,
  Lock,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Leaflet imports
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface FreshnessInfo {
  colorClass: string;
  textColorClass: string;
  text: string;
  percentage: number;
}

function getFreshnessInfo(harvestDateStr: string, expiryDateStr?: string): FreshnessInfo {
  const harvestDate = new Date(harvestDateStr);
  const expiryDate = expiryDateStr ? new Date(expiryDateStr) : new Date(harvestDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  
  const total = expiryDate.getTime() - harvestDate.getTime();
  const elapsed = now.getTime() - harvestDate.getTime();
  
  const elapsedDays = Math.max(0, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
  const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  
  let percentage = total > 0 ? elapsed / total : 1;
  percentage = Math.min(1, Math.max(0, percentage));

  let colorClass = 'bg-[#2D6A4F]';
  let textColorClass = 'text-[#2D6A4F]';
  let status = 'freshly harvested';

  if (percentage > 0.75) {
    colorClass = 'bg-[#DC2626]';
    textColorClass = 'text-[#DC2626] font-semibold';
    status = 'near-spoilage (CRITICAL)';
  } else if (percentage > 0.35) {
    colorClass = 'bg-[#D97706]';
    textColorClass = 'text-[#D97706] font-medium';
    status = 'approaching expiry';
  }

  return {
    colorClass,
    textColorClass,
    text: `Harvested ${elapsedDays} day${elapsedDays !== 1 ? 's' : ''} ago · Expires in ${remainingDays} day${remainingDays !== 1 ? 's' : ''} (${status})`,
    percentage,
  };
}

interface ListingDetailMapProps {
  latitude: number;
  longitude: number;
}

const ListingDetailMap: React.FC<ListingDetailMapProps> = ({ latitude, longitude }) => {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const container = mapContainerRef.current;
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    try {
      const map = L.map(container, {
        center: [latitude, longitude],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      L.circle([latitude, longitude], {
        radius: 500,
        color: '#2D6A4F',
        fillColor: '#2D6A4F',
        fillOpacity: 0.25,
      }).addTo(map);

      mapInstanceRef.current = map;
    } catch (err) {
      console.error('Failed to initialize Leaflet map:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (container) {
        delete (container as any)._leaflet_id;
      }
    };
  }, [latitude, longitude]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
};

export const ListingDetailBuyerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAuth(); // Enforce JWT guards

  const [listing, setListing] = useState<DetailedListing | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Carousel state
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);

  // Form states
  const [quantity, setQuantity] = useState<string>('10');
  const [orderError, setOrderError] = useState<string>('');
  const [ordering, setOrdering] = useState<boolean>(false);

  // Co-op States
  const [coOps, setCoOps] = useState<CoOpGroup[]>([]);
  const [fetchingCoOps, setFetchingCoOps] = useState<boolean>(false);
  const [showCreateCoOp, setShowCreateCoOp] = useState<boolean>(false);
  const [coOpTarget, setCoOpTarget] = useState<string>('500');
  const [coOpContribution, setCoOpContribution] = useState<string>('100');
  const [joinQuantities, setJoinQuantities] = useState<Record<string, string>>({});
  const [pendingPaymentMember, setPendingPaymentMember] = useState<any | null>(null);

  const fetchListing = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await ListingsApi.getListingById(id);
      setListing(res);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load listing details');
      navigate('/marketplace');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoOps = async () => {
    if (!id) return;
    setFetchingCoOps(true);
    try {
      const data = await CoOpApi.getActiveCoOps(id);
      setCoOps(data);
    } catch (err) {
      console.error('Failed to fetch active co-ops:', err);
    } finally {
      setFetchingCoOps(false);
    }
  };

  useEffect(() => {
    fetchListing();
    fetchCoOps();
  }, [id]);

  const handleCreateCoOp = async () => {
    if (!id) return;
    const target = parseFloat(coOpTarget);
    const contrib = parseFloat(coOpContribution);

    if (isNaN(target) || target <= 0) {
      toast.error('Please enter a valid target quantity');
      return;
    }
    if (isNaN(contrib) || contrib <= 0 || contrib > target) {
      toast.error('Your share must be greater than zero and less than or equal to the target');
      return;
    }

    try {
      const result = await CoOpApi.createCoOp(id, target, contrib);
      toast.success('Co-op group created successfully! Complete payment to activate.');
      
      const creatorMember = result.members.find((m: any) => m.buyerId === result.creatorId);
      setPendingPaymentMember(creatorMember || result.members[0]);
      
      setShowCreateCoOp(false);
      fetchCoOps();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create co-op group buy');
    }
  };

  const handleJoinCoOp = async (coOpGroupId: string, qty: number) => {
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid contribution size');
      return;
    }

    try {
      const result = await CoOpApi.joinCoOp(coOpGroupId, qty);
      toast.success('Successfully requested to join co-op group buy! Complete payment to activate.');
      
      setPendingPaymentMember(result);
      
      setJoinQuantities((prev) => ({ ...prev, [coOpGroupId]: '' }));
      fetchCoOps();
    } catch (err: any) {
      toast.error(err.message || 'Failed to join co-op group buy');
    }
  };

  const handleSimulateCoOpPayment = async () => {
    if (!pendingPaymentMember) return;
    try {
      await CoOpApi.simulatePayment(pendingPaymentMember.id);
      toast.success('Simulated payment successful! Group buy updated.');
      setPendingPaymentMember(null);
      fetchCoOps();
      fetchListing();
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify payment simulation');
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
        <Button variant="ghost" onClick={() => navigate('/marketplace')} className="mt-4">
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const farmerName = listing.farmer?.name || 'Local Farmer';
  const farmerInitials = farmerName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const imageList = listing.images || [];
  const hasImages = imageList.length > 0;
  
  const fresh = getFreshnessInfo(listing.harvestDate, listing.expiryEstimate);

  // Form validations
  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const num = parseFloat(val);
    if (isNaN(num)) {
      setOrderError('Quantity must be a valid number');
    } else if (num < 10) {
      setOrderError('Minimum order quantity is 10 kg');
    } else if (num > listing.remainingKg) {
      setOrderError(`Only ${listing.remainingKg} kg available`);
    } else {
      setOrderError('');
    }
  };

  // Calculations
  const qtyNum = parseFloat(quantity) || 0;
  const totalPrice = qtyNum * listing.pricePerKg;

  const handlePlaceOrder = async () => {
    if (orderError || qtyNum <= 0) {
      toast.error('Please resolve validation errors before ordering');
      return;
    }

    setOrdering(true);
    try {
      const res = await OrdersApi.createOrder({
        listingId: listing.id,
        quantityKg: qtyNum,
      });
      toast.success('Order placed successfully!');
      navigate(`/orders/${res.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="space-y-6 bg-white min-h-screen pb-16">
      {/* Breadcrumb & Navigation */}
      <div className="space-y-2">
        <button
          onClick={() => navigate('/marketplace')}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Marketplace Home</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] font-display">
          Batch Marketplace Profile
        </h1>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Carousel Card */}
          <Card className="p-0 border border-[#E5E7EB] rounded-2xl overflow-hidden relative">
            <div className="relative w-full h-[280px] sm:h-[380px] bg-[#EAF4EE] flex items-center justify-center">
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
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 select-none">
                  <Leaf className="w-12 h-12 text-[#2D6A4F]" />
                  <span className="text-xs text-[#6B7280]">No images uploaded for this batch</span>
                </div>
              )}
            </div>

            {/* Pagination indicators overlay */}
            {imageList.length > 1 && (
              <div className="p-3.5 bg-white border-t border-[#E5E7EB] flex justify-center gap-1.5">
                {imageList.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === activeImageIdx ? 'bg-[#2D6A4F] scale-110' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* 2. Farmer Profile Card */}
          <Card className="border border-[#E5E7EB] p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#2D6A4F] text-white font-bold text-base flex items-center justify-center border-2 border-white shadow-md">
                  {farmerInitials}
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary leading-tight">
                    {farmerName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                    <MapPin className="w-3.5 h-3.5 text-[#DC2626]" />
                    <span>
                      {listing.farmer?.district || 'District'}, {listing.farmer?.region || 'Region'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stars & Reviews */}
              <div className="flex items-center gap-3">
                <div className="flex items-center text-xs text-amber-500 bg-amber-50 px-2 py-1 rounded border border-amber-200/50">
                  <Star className="w-3.5 h-3.5 fill-current mr-1" />
                  <span className="font-bold">5.0</span>
                  <span className="text-[10px] text-text-secondary ml-1">(12 reviews)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<MessageCircle className="w-4 h-4" />}
                  onClick={() => navigate(`/messages?userId=${listing.farmerId}&userName=${encodeURIComponent(farmerName)}&userRole=FARMER`)}
                >
                  Message Farmer
                </Button>
              </div>
            </div>
          </Card>

          {/* 3. Freshness Bar (Larger) */}
          <Card className="border border-[#E5E7EB] p-5 space-y-3">
            <h4 className="text-sm font-bold text-text-primary">Estimated Freshness Level</h4>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className={`h-full ${fresh.colorClass} transition-all duration-300`}
                style={{ width: `${(1 - fresh.percentage) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className={`font-semibold ${fresh.textColorClass}`}>{fresh.text}</span>
              <span className="text-[#9CA3AF]">Remaining shelf life: {Math.round((1 - fresh.percentage) * 100)}%</span>
            </div>
          </Card>

          {/* 4. Listing Details Card */}
          <Card className="border border-[#E5E7EB] p-5 space-y-4">
            <h4 className="text-sm font-bold text-text-primary border-b border-[#E5E7EB] pb-2">
              Batch Agricultural Specifications
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm text-text-secondary">
              <div>
                <p className="font-semibold text-text-primary">Crop Type</p>
                <div className="mt-1">
                  <CropTypeBadge cropType={listing.cropType} />
                </div>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Quality Grade</p>
                <div className="mt-1">
                  <Badge variant="warning" label={`Grade ${listing.qualityGrade || 'UNGRADED'}`} />
                  <span className="text-xs text-[#9CA3AF] ml-2">
                    ({listing.qualityGradeSource === 'AI' ? 'AI Assessed' : 'Manually Set'})
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-[#F3F4F6] pt-3" />

              <div>
                <p className="font-semibold text-text-primary">Harvest Date</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#9CA3AF]" />
                  <span>{new Date(listing.harvestDate).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Expiry Estimate</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#9CA3AF]" />
                  <span>
                    {listing.expiryEstimate
                      ? new Date(listing.expiryEstimate).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-[#F3F4F6] pt-3" />

              <div>
                <p className="font-semibold text-text-primary">Traceability Inputs</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {listing.traceability?.inputsUsed && listing.traceability.inputsUsed.length > 0 ? (
                    listing.traceability.inputsUsed.map((i, idx) => (
                      <Badge key={idx} variant="primary" label={i} />
                    ))
                  ) : (
                    <span className="text-xs italic text-[#9CA3AF]">None disclosed</span>
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-text-primary">Planting Date</p>
                <p className="mt-1">
                  {listing.traceability?.plantingDate
                    ? new Date(listing.traceability.plantingDate).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
            </div>
          </Card>

          {/* 5. Map Card */}
          <Card className="border border-[#E5E7EB] p-5 space-y-3">
            <div className="flex items-center gap-1 text-[#111827]">
              <MapPin className="w-4.5 h-4.5 text-[#DC2626]" />
              <h4 className="text-sm font-bold">Approximate Fulfillment Location</h4>
            </div>
            <p className="text-xs text-text-secondary">
              Farm coordinates secured for transport match logic. Approximate loading location radius is shown below:
            </p>
            <div className="w-full h-[220px] rounded-xl overflow-hidden border border-[#E5E7EB] z-10 relative">
              <ListingDetailMap latitude={listing.latitude} longitude={listing.longitude} />
            </div>
          </Card>

          {/* 6. Reviews Section */}
          <UserReviewsPanel userId={listing.farmerId} />
        </div>

        {/* Right Column: Order Form Panel (Sticky) */}
        <div className="space-y-6 lg:sticky lg:top-20">
          <Card className="border border-[#E5E7EB] p-5 space-y-5 shadow-card bg-white">
            <h3 className="text-base font-bold text-[#111827] border-b border-[#E5E7EB] pb-2 font-display">
              Place an Order
            </h3>

            {/* Quantity Input */}
            <div className="space-y-1">
              <Input
                label="Required Volume"
                type="number"
                min="10"
                step="any"
                required
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                error={orderError}
                rightIcon={<span className="text-xs font-semibold pr-3">kg</span>}
              />
              <p className="text-[11px] text-text-secondary mt-1">
                Min 10 kg, {listing.remainingKg} kg available
              </p>
            </div>

            {/* Calculations Preview */}
            <div className="p-3 bg-gray-50 border border-[#E5E7EB] rounded-card space-y-2 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Unit Price</span>
                <span className="font-mono">GHS {listing.pricePerKg.toFixed(2)} / kg</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Selected weight</span>
                <span className="font-mono">{qtyNum} kg</span>
              </div>
              <div className="border-t border-[#E5E7EB] my-1" />
              <div className="flex justify-between items-baseline pt-1 border-l-4 border-[#2D6A4F] pl-2 bg-white p-2 rounded-md">
                <span className="font-bold text-[#111827]">Total Cost</span>
                <span className="font-mono text-base font-extrabold text-[#111827]">
                  GHS {totalPrice.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Order trigger */}
            <Button
              variant="primary"
              fullWidth
              size="lg"
              className="h-[52px] rounded-card text-base font-bold"
              disabled={!!orderError || qtyNum <= 0}
              isLoading={ordering}
              onClick={handlePlaceOrder}
            >
              Place Order
            </Button>

            {/* Lock secured details */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#9CA3AF]">
              <Lock className="w-3.5 h-3.5" />
              <span>Secure order & inventory escrow checkout</span>
            </div>
          </Card>

          {/* Batch trace code chip */}
          <div className="p-4 bg-[#EAF4EE] border border-[#D1E7DD] rounded-2xl flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <p className="text-[10px] text-[#2D6A4F] font-bold uppercase tracking-wider">
                Blockchain Batch Trace
              </p>
              <p className="font-mono text-xs font-semibold text-[#2D6A4F]">
                {listing.batchCode}
              </p>
            </div>
            <Link
              to={`/trace/${listing.batchCode}`}
              className="text-xs font-bold text-[#2D6A4F] hover:text-[#235A41] flex items-center gap-0.5"
            >
              <span>Trace batch</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Co-operative Group Buy Card */}
          <Card className="border border-[#E5E7EB] p-5 space-y-4 bg-[#F9FAFB] rounded-2xl">
            <div className="border-b border-[#E5E7EB] pb-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-[#111827]">
                Co-operative Group Buy
              </h3>
              <Badge variant="success" label="Save Delivery GHS" />
            </div>
            
            <p className="text-xs text-text-secondary leading-relaxed">
              Co-purchase wholesale batches of produce with neighboring buyers. Once the target weight is met, your orders are confirmed and delivery routes are automatically pooled!
            </p>

            {/* List of Active Co-Ops */}
            {fetchingCoOps ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary-green/20 border-t-primary-green rounded-full animate-spin" />
              </div>
            ) : coOps.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Open Group Buys:
                </p>
                {coOps.map((group) => {
                  const contributed = group.members.filter((m: any) => m.paymentStatus === 'PAID').reduce((sum: number, m: any) => sum + m.quantityKg, 0);
                  const progress = Math.min(100, Math.round((contributed / group.targetQuantity) * 100));
                  const hoursLeft = Math.max(0, Math.round((new Date(group.deadline).getTime() - Date.now()) / (1000 * 60 * 60)));
                  const spaceRemaining = group.targetQuantity - contributed;

                  return (
                    <div key={group.id} className="p-4 bg-white border border-[#E5E7EB] rounded-2xl space-y-3 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-[#111827]">
                            Group by {group.creator?.name || 'Buyer'}
                          </p>
                          <p className="text-[10px] text-text-secondary">
                            Expires in {hoursLeft} hours
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#2D6A4F] bg-[#EAF4EE] px-2 py-0.5 rounded">
                          {progress}% filled
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#2D6A4F]" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-text-secondary font-mono">
                          <span>Contributed: {contributed} kg</span>
                          <span>Target: {group.targetQuantity} kg</span>
                        </div>
                      </div>

                      {/* Join Sub-Form */}
                      {spaceRemaining > 0 && (
                        <div className="pt-2 flex items-end gap-2">
                          <div className="flex-1">
                            <input
                              type="number"
                              placeholder="Qty (kg)"
                              min="5"
                              max={spaceRemaining}
                              className="w-full h-[36px] px-3 border border-[#E5E7EB] rounded-xl text-xs"
                              value={joinQuantities[group.id] || ''}
                              onChange={(e) => setJoinQuantities(prev => ({ ...prev, [group.id]: e.target.value }))}
                            />
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!joinQuantities[group.id] || parseFloat(joinQuantities[group.id]) <= 0 || parseFloat(joinQuantities[group.id]) > spaceRemaining}
                            onClick={() => handleJoinCoOp(group.id, parseFloat(joinQuantities[group.id]))}
                          >
                            Join
                          </Button>
                        </div>
                      )}
                      <p className="text-[9px] text-slate-400 italic">
                        {spaceRemaining} kg remaining space
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-secondary text-center py-4 bg-slate-50 border border-dashed border-[#E5E7EB] rounded-2xl italic">
                No active group buys for this crop yet.
              </p>
            )}

            {/* Toggle Start Group Buy Form */}
            {!showCreateCoOp ? (
              <Button
                variant="outline"
                fullWidth
                size="sm"
                onClick={() => setShowCreateCoOp(true)}
              >
                Start a new Group Buy
              </Button>
            ) : (
              <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl space-y-4 shadow-sm">
                <h4 className="text-xs font-bold text-text-primary border-b pb-1.5">
                  Configure Co-op Parameters
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-text-primary">Co-op Target Quantity (kg)</label>
                    <input
                      type="number"
                      min="50"
                      max={listing.remainingKg}
                      className="w-full h-[38px] px-3 mt-1 border border-[#E5E7EB] rounded-xl text-xs"
                      value={coOpTarget}
                      onChange={(e) => setCoOpTarget(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-text-primary">Your Initial Share (kg)</label>
                    <input
                      type="number"
                      min="10"
                      max={coOpTarget}
                      className="w-full h-[38px] px-3 mt-1 border border-[#E5E7EB] rounded-xl text-xs"
                      value={coOpContribution}
                      onChange={(e) => setCoOpContribution(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowCreateCoOp(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    disabled={!coOpTarget || !coOpContribution || parseFloat(coOpContribution) > parseFloat(coOpTarget)}
                    onClick={handleCreateCoOp}
                  >
                    Launch Group
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Payment Simulation Modal */}
      {pendingPaymentMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#EAF4EE] text-[#2D6A4F] font-bold flex items-center justify-center mx-auto text-xl">
                💳
              </div>
              <h3 className="text-lg font-bold text-[#111827]">
                Complete Co-Op Share Payment
              </h3>
              <p className="text-xs text-text-secondary">
                Simulate paystack checkout verification for your co-op contribution.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl text-xs space-y-3 font-medium text-slate-700">
              <div className="flex justify-between">
                <span>Produce Crop</span>
                <span className="font-bold text-text-primary">{listing.cropType}</span>
              </div>
              <div className="flex justify-between">
                <span>Contribution Share</span>
                <span className="font-mono font-bold text-text-primary">{pendingPaymentMember.quantityKg} kg</span>
              </div>
              <div className="flex justify-between border-t border-[#E5E7EB] pt-2.5">
                <span>Amount to Pay</span>
                <span className="font-mono font-extrabold text-base text-[#2D6A4F]">
                  GHS {pendingPaymentMember.paidAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={handleSimulateCoOpPayment}
              >
                Simulate Successful Payment
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setPendingPaymentMember(null)}
              >
                Close & Pay Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingDetailBuyerPage;
