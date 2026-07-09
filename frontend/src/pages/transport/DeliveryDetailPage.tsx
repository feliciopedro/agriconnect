import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DeliveryApi } from '../../api/delivery.api';
import type { EstimateCostResponse } from '../../api/delivery.api';
import type { DeliveryRequest } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CropTypeBadge } from '../../components/ui/CropTypeBadge';
import {
  ArrowLeft,
} from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// SVG stop icons
const pickupIcon = L.divIcon({
  html: `<div class="w-7 h-7 rounded-full bg-[#EAF4EE] border-2 border-[#2D6A4F] flex items-center justify-center shadow-lg font-bold text-xs text-[#2D6A4F]">↑</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

const dropoffIcon = L.divIcon({
  html: `<div class="w-7 h-7 rounded-full bg-[#FDF2F2] border-2 border-[#DC2626] flex items-center justify-center shadow-lg font-bold text-xs text-[#DC2626]">↓</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

export const DeliveryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAuth(); // Enforce auth check

  const [delivery, setDelivery] = useState<DeliveryRequest | null>(null);
  const [estimate, setEstimate] = useState<EstimateCostResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const details = await DeliveryApi.getDeliveryRequest(id);
      setDelivery(details);

      // Fetch dynamic cost breakdown
      const costDetails = await DeliveryApi.estimateDeliveryCost(id);
      setEstimate(costDetails);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load route details');
      navigate('/transporter');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white space-y-4">
        <Spinner size="lg" />
        <p className="text-text-secondary text-sm">Loading delivery details...</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="text-center py-20 bg-white">
        <p className="text-[#DC2626] font-semibold">Delivery route not found</p>
        <Button variant="ghost" onClick={() => navigate('/transporter')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const farmerName = delivery.order?.listing?.farmer?.name || 'Local Farmer';
  const buyerName = delivery.order?.buyer?.name || 'Buyer';

  const routeLineCoords: [number, number][] = [
    [delivery.pickupLatitude, delivery.pickupLongitude],
    [delivery.dropoffLatitude, delivery.dropoffLongitude],
  ];

  return (
    <div className="bg-white min-h-screen pb-16 space-y-6 sm:space-y-8">
      {/* Navigation & Breadcrumbs */}
      <div className="space-y-2">
        <button
          onClick={() => navigate('/transporter')}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Deliveries Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] font-display flex items-center gap-2">
          <span>Logistics Route Summary</span>
          {delivery.isCarpool && (
            <Badge variant="success" label="Shared Logistics (Carpool)" className="bg-emerald-100 text-emerald-800 text-xs font-bold" />
          )}
        </h1>
      </div>

      {/* Header Route strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 border border-[#E5E7EB] rounded-2xl divide-y md:divide-y-0 md:divide-x divide-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {[
          { label: 'Stops Count', val: '2 Stops', desc: 'Pickup & Dropoff' },
          { label: 'Fulfillment Distance', val: `${(delivery.routeDistanceKm || 0).toFixed(1)} km`, desc: 'Estimated road route' },
          { label: 'Transit Duration', val: `${Math.round(delivery.routeDurationMin || 0)} mins`, desc: 'Average traffic flow' },
        ].map((item, idx) => (
          <div key={idx} className="p-5 text-center md:text-left space-y-1">
            <span className="text-xs font-semibold text-[#6B7280]">{item.label}</span>
            <p className="text-xl font-bold text-[#111827]">{item.val}</p>
            <p className="text-[11px] text-text-secondary">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Full Route Map */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-text-primary">Fulfillment Route Map</h3>
        <div className="w-full h-[320px] rounded-2xl overflow-hidden border border-[#E5E7EB] z-10 relative">
          <MapContainer
            center={[delivery.pickupLatitude, delivery.pickupLongitude]}
            zoom={12}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Pickup pin */}
            <Marker position={[delivery.pickupLatitude, delivery.pickupLongitude]} icon={pickupIcon}>
              <Popup>
                <div className="text-xs space-y-1 font-semibold">
                  <p className="text-[#2D6A4F]">↑ Pickup location</p>
                  <p>{farmerName}</p>
                </div>
              </Popup>
            </Marker>

            {/* Dropoff pin */}
            <Marker position={[delivery.dropoffLatitude, delivery.dropoffLongitude]} icon={dropoffIcon}>
              <Popup>
                <div className="text-xs space-y-1 font-semibold">
                  <p className="text-[#DC2626]">↓ Dropoff location</p>
                  <p>{buyerName}</p>
                </div>
              </Popup>
            </Marker>

            {/* Route path line */}
            <Polyline positions={routeLineCoords} pathOptions={{ color: '#2D6A4F', weight: 4 }} />
          </MapContainer>
        </div>
      </div>

      {/* Sequenced stop list */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-text-primary">Route Stops Sequence</h3>
        <div className="space-y-4">
          {/* Pickup Card */}
          <Card className="border border-[#E5E7EB] bg-white p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-[#EAF4EE] text-[#2D6A4F] font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-text-primary">Pickup point: {farmerName}</h4>
                <p className="text-xs text-text-secondary leading-tight">
                  {delivery.order?.listing?.farmer?.district || 'District'}, {delivery.order?.listing?.farmer?.region || 'Region'}
                </p>
                <div className="pt-1.5 flex items-center gap-2">
                  <CropTypeBadge cropType={delivery.order?.listing?.cropType || 'TOMATO'} size="sm" />
                  <span className="text-xs font-bold text-text-primary">
                    {delivery.order?.quantityKg} kg
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9CA3AF]">
                Scheduled: {delivery.scheduledPickup ? new Date(delivery.scheduledPickup).toLocaleDateString() : 'N/A'}
              </span>
              <Badge
                variant={delivery.status !== 'REQUESTED' && delivery.status !== 'MATCHED' ? 'success' : 'warning'}
                label={delivery.status !== 'REQUESTED' && delivery.status !== 'MATCHED' ? 'Loaded' : 'Pending Loading'}
              />
            </div>
          </Card>

          {/* Dropoff Card */}
          <Card className="border border-[#E5E7EB] bg-white p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-[#FDF2F2] text-[#DC2626] font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-text-primary">Dropoff point: {buyerName}</h4>
                <p className="text-xs text-text-secondary leading-tight">
                  {delivery.order?.deliveryAddress || 'Fulfillment address'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9CA3AF]">
                ETA: {delivery.eta ? new Date(delivery.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
              </span>
              <Badge
                variant={delivery.status === 'DELIVERED' ? 'success' : 'warning'}
                label={delivery.status === 'DELIVERED' ? 'Delivered' : 'Pending Dropoff'}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Earnings breakdown Card */}
      {estimate && (
        <Card className="border border-[#E5E7EB] p-5 space-y-4 bg-white shadow-sm max-w-md">
          <h3 className="text-sm font-bold text-text-primary border-b border-[#E5E7EB] pb-2 uppercase tracking-wider text-[10px]">
            Earnings Fee Breakdown
          </h3>
          <div className="space-y-2 text-xs text-text-secondary">
            <div className="flex justify-between">
              <span>Base Escrow Fee</span>
              <span className="font-mono">GHS {estimate.baseFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Fulfillment Distance Charge</span>
              <span className="font-mono">GHS {estimate.distanceFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cargo Weight Commission</span>
              <span className="font-mono">GHS {estimate.weightFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-[#E5E7EB] my-2.5" />
            <div className="flex justify-between items-baseline pt-1">
              <span className="font-bold text-[#111827]">
                {delivery.isCarpool ? 'Carpool Split Cost' : 'Total Payout Earnings'}
              </span>
              <span className="font-mono text-base font-extrabold text-[#C8960C]">
                GHS {(delivery.isCarpool ? (delivery.carpoolSplitCost ?? 0) : estimate.totalCost).toFixed(2)}
              </span>
            </div>
            {delivery.isCarpool && (
              <div className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 p-2 rounded-lg mt-2 flex items-center justify-between">
                <span>Shared Logistics Discount Active</span>
                <span>Saved GHS {(estimate.totalCost - (delivery.carpoolSplitCost || 0)).toFixed(2)}</span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default DeliveryDetailPage;
