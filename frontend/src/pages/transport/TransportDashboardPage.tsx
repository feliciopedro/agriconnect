import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DeliveryApi } from '../../api/delivery.api';
import { AuthApi } from '../../api/auth.api';
import type { DeliveryRequest } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CropTypeBadge } from '../../components/ui/CropTypeBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Navigation,
  ExternalLink,
  CheckCircle2,
  DollarSign,
  Package,
  Clock,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// Leaflet map imports
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// SVG icons for pickup, dropoff, and vehicle
const pickupIcon = L.divIcon({
  html: `<div class="w-6 h-6 rounded-full bg-[#EAF4EE] border-2 border-[#2D6A4F] flex items-center justify-center shadow-md font-bold text-[10px] text-[#2D6A4F]">↑</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const dropoffIcon = L.divIcon({
  html: `<div class="w-6 h-6 rounded-full bg-[#FDF2F2] border-2 border-[#DC2626] flex items-center justify-center shadow-md font-bold text-[10px] text-[#DC2626]">↓</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const userTransporterIcon = L.divIcon({
  html: `<div class="w-6.5 h-6.5 rounded-full bg-[#2563EB] border-2 border-white shadow-xl flex items-center justify-center"><div class="w-2.5 h-2.5 bg-white rounded-full animate-ping"></div></div>`,
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// Geodetic Distance helper
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface MiniRouteMapProps {
  job: DeliveryRequest;
  myLat: number;
  myLng: number;
  farmerName: string;
  buyerName: string;
}

const MiniRouteMap: React.FC<MiniRouteMapProps> = ({ job, myLat, myLng, farmerName, buyerName }) => {
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
        center: [myLat, myLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      // Transporter location
      L.marker([myLat, myLng], { icon: userTransporterIcon }).addTo(map)
        .bindPopup('<span class="text-xs font-semibold">Your Location</span>');

      // Pickup stop pin
      L.marker([job.pickupLatitude, job.pickupLongitude], { icon: pickupIcon }).addTo(map)
        .bindPopup(`<span class="text-xs font-semibold">Pickup: ${farmerName}</span>`);

      // Dropoff stop pin
      L.marker([job.dropoffLatitude, job.dropoffLongitude], { icon: dropoffIcon }).addTo(map)
        .bindPopup(`<span class="text-xs font-semibold">Dropoff: ${buyerName}</span>`);

      // Polyline route path
      L.polyline([
        [job.pickupLatitude, job.pickupLongitude],
        [job.dropoffLatitude, job.dropoffLongitude]
      ], { color: '#2D6A4F', weight: 3 }).addTo(map);

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
  }, [job, myLat, myLng, farmerName, buyerName]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
};

export const TransportDashboardPage: React.FC = () => {
  const { user, token, login } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [availableUngrouped, setAvailableUngrouped] = useState<DeliveryRequest[]>([]);
  const [availableGrouped, setAvailableGrouped] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<DeliveryRequest[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'available' | 'my_jobs'>('available');
  const [togglingAvailability, setTogglingAvailability] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Grouped route expanded details toggler keys
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Telemetry position (Accra coordinates mock center)
  const [myLat, setMyLat] = useState<number>(5.6037);
  const [myLng, setMyLng] = useState<number>(-0.187);

  const isAvailable = user?.transportProfile?.isAvailable || false;

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Capture transporter geoloc coordinates
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setMyLat(pos.coords.latitude);
            setMyLng(pos.coords.longitude);
          },
          () => console.log('Using default geolocation coordinates')
        );
      }

      // 2. Fetch available requests
      const avail = await DeliveryApi.getAvailableDeliveryRequests();
      const responseAvail = avail as any;
      setAvailableUngrouped(responseAvail.ungrouped || []);
      setAvailableGrouped(responseAvail.groupedRoutes || []);

      // 3. Fetch matched jobs list
      const jobs = await DeliveryApi.getMyJobs();
      setMyJobs(jobs || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to query active logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const toggleAvailability = async () => {
    setTogglingAvailability(true);
    try {
      const updated = await AuthApi.updateProfile({ isAvailable: !isAvailable });
      if (token) {
        login(token, updated);
      }
      toast.success(`Availability turned ${!isAvailable ? 'ON' : 'OFF'}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to sync availability');
    } finally {
      setTogglingAvailability(false);
    }
  };

  const handleAcceptSingle = async (id: string) => {
    setActionLoading(id);
    try {
      await DeliveryApi.acceptDeliveryRequest(id);
      toast.success('Delivery route matched successfully!');
      loadData();
      setActiveTab('my_jobs');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to accept delivery');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptGrouped = async (groupId: string, requestIds: string[]) => {
    setActionLoading(groupId);
    try {
      // Accept each sequential stop ID in the transaction list
      for (const id of requestIds) {
        await DeliveryApi.acceptDeliveryRequest(id);
      }
      toast.success('Optimized Grouped Route Accepted!');
      loadData();
      setActiveTab('my_jobs');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to accept batched route group');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'PICKED_UP' | 'DELIVERED') => {
    setActionLoading(id);
    try {
      await DeliveryApi.updateDeliveryStatus(id, status, myLat, myLng);
      toast.success(`Cargo status updated: ${status.replace('_', ' ')}!`);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update cargo telemetry status');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    if (expandedGroups.includes(groupId)) {
      setExpandedGroups(expandedGroups.filter((g) => g !== groupId));
    } else {
      setExpandedGroups([...expandedGroups, groupId]);
    }
  };

  // Metrics Calculations
  const activeJobs = myJobs.filter((j) => j.status === 'MATCHED' || j.status === 'PICKED_UP');
  const completedJobs = myJobs.filter((j) => j.status === 'DELIVERED');
  
  // Completed Today metrics sum
  const completedToday = completedJobs.filter((j) => {
    const d = new Date(j.updatedAt);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  });

  const estEarningsToday = completedToday.reduce((sum, j) => sum + (j.carpoolSplitCost || j.estimatedCost || 0), 0);

  return (
    <div className="bg-white min-h-screen pb-16 space-y-6 sm:space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] font-display">
          Deliveries
        </h1>
        <p className="text-sm text-text-secondary">
          Manage optimization routes, accept local listings cargo, and track active client shipments.
        </p>
      </div>

      {/* Prominent Availability Switch Box */}
      <Card
        className={`bg-white border border-[#E5E7EB] p-4 flex items-center justify-between shadow-sm transition-all duration-300 ${
          isAvailable ? 'border-l-[4px] border-l-[#2D6A4F]' : 'border-l-[4px] border-l-gray-400'
        }`}
      >
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-text-primary">Fulfillment Status</h4>
          <p className="text-xs text-text-secondary">
            {isAvailable
              ? 'You are online and visible to active farm dispatch groups.'
              : 'Toggle online to receive automated route matches.'}
          </p>
        </div>
        <button
          onClick={toggleAvailability}
          disabled={togglingAvailability}
          className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isAvailable ? 'bg-[#2D6A4F]' : 'bg-gray-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isAvailable ? 'translate-x-5.5' : 'translate-x-0'
            }`}
          />
        </button>
      </Card>

      {/* Summary strip - 3 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Active Jobs', val: activeJobs.length, icon: <Navigation className="w-5 h-5 text-[#2D6A4F]" /> },
          { label: 'Completed Today', val: completedToday.length, icon: <CheckCircle2 className="w-5 h-5 text-[#2D6A4F]" /> },
          {
            label: 'Est. Earnings Today',
            val: `GHS ${estEarningsToday.toFixed(2)}`,
            icon: <DollarSign className="w-5 h-5 text-[#2D6A4F]" />,
            mono: true,
          },
        ].map((stat, idx) => (
          <Card
            key={idx}
            className="border-t-[3px] border-t-[#2D6A4F] border-x border-b border-[#E5E7EB] p-4 flex items-center justify-between bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          >
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#6B7280]">{stat.label}</span>
              <p className={`text-2xl font-bold text-[#111827] ${stat.mono ? 'font-mono' : ''}`}>
                {stat.val}
              </p>
            </div>
            <div className="p-2 bg-[#EAF4EE]/40 border border-[#2D6A4F]/10 rounded-lg">{stat.icon}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB] bg-white flex overflow-x-auto scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6">
        {[
          { key: 'available', label: 'Available Routes' },
          { key: 'my_jobs', label: `My Jobs (${activeJobs.length})` },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-3 px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#2D6A4F] text-[#111827]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white">
          <Spinner size="lg" />
          <p className="text-text-secondary text-xs mt-3">Syncing route dispatches...</p>
        </div>
      ) : activeTab === 'available' ? (
        /* AVAILABLE TAB ROUTING GRID */
        <div key="available-tab" className="space-y-6">
          {/* Availability notice */}
          {!isAvailable && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2.5">
              <Clock className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-bold">Offline:</span> Turn on availability at the top of the screen to start matching client delivery dispatches.
              </div>
            </div>
          )}

          {availableUngrouped.length === 0 && availableGrouped.length === 0 ? (
            <EmptyState
              title="No available dispatches"
              description="No crop deliveries requested in your district service zone currently."
              icon={<RefreshCw className="w-10 h-10 text-[#9CA3AF]" />}
              action={
                <Button variant="secondary" onClick={loadData}>
                  Refresh Dispatch
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {/* Grouped Optimized recommended routes first */}
              {availableGrouped.map((group) => {
                const isExpanded = expandedGroups.includes(group.routeGroupId);
                const reqIds = group.members.map((m: any) => m.id);
                
                // Sums
                const totalCarpoolEarnings = group.members.reduce((sum: number, m: any) => sum + (m.carpoolSplitCost || m.estimatedCost || 0), 0);
                const totalStandaloneEarnings = group.members.reduce((sum: number, m: any) => sum + (m.estimatedCost || 0), 0);
                const firstMember = group.members[0];
                const distanceKm = firstMember?.routeDistanceKm || 12.5;

                return (
                  <Card
                    key={group.routeGroupId}
                    className="border-l-[3px] border-l-[#2D6A4F] border-y border-r border-[#E5E7EB] bg-white p-5 space-y-4 shadow-[0_2px_8px_rgba(45,106,79,0.06)]"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="primary" label="Grouped Route" className="bg-[#EAF4EE] text-[#2D6A4F]" />
                          <Badge variant="success" label="Shared Logistics (Carpool)" className="bg-emerald-100 text-emerald-800" />
                          <span className="text-[10px] text-text-muted font-mono">{group.routeGroupId.slice(0, 8)}</span>
                        </div>
                        <h4 className="text-sm font-bold text-text-primary">
                          Recommended Batch Multi-Stop Delivery
                        </h4>
                      </div>
                      <button
                        onClick={() => toggleGroupExpand(group.routeGroupId)}
                        className="text-xs text-[#2D6A4F] font-bold hover:underline select-none cursor-pointer"
                      >
                        {isExpanded ? 'Hide stops' : 'Show sequence'}
                      </button>
                    </div>

                    {/* stops dropdown */}
                    {isExpanded && (
                      <div className="border-t border-[#F3F4F6] pt-3.5 space-y-3">
                        <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                          Transit stop locations:
                        </p>
                        <div className="space-y-3 pl-3 border-l-2 border-gray-100">
                          {group.members.map((member: any, idx: number) => {
                            const farmerName = member.order?.listing?.farmer?.name || 'Farmer';
                            const buyerName = member.order?.buyer?.name || 'Buyer';
                            
                            return (
                              <div key={member.id} className="text-xs space-y-1 text-text-secondary">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                                    <span className="w-4 h-4 rounded-full bg-[#EAF4EE] text-[#2D6A4F] text-[9px] flex items-center justify-center font-bold">
                                      {idx + 1}
                                    </span>
                                    <span>Pickup from {farmerName}</span>
                                  </div>
                                  <span className="font-mono font-bold text-[#2D6A4F]">
                                    GHS {(member.carpoolSplitCost || member.estimatedCost || 0).toFixed(2)} split
                                    {member.carpoolSplitCost && (
                                      <span className="text-[#9CA3AF] text-[10px] font-normal ml-1.5 line-through">
                                        (GHS {member.estimatedCost.toFixed(2)})
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <p className="pl-5 text-[#6B7280]">
                                  {member.order?.listing?.district || 'District'}, {member.order?.listing?.region || 'Region'} ({member.order?.listing?.cropType})
                                </p>
                                <div className="flex items-center gap-1.5 font-semibold text-text-primary pl-5">
                                  <span>↓ Deliver to {buyerName}</span>
                                </div>
                                <p className="pl-10 text-[#6B7280]">
                                  {member.order?.deliveryAddress || 'Address'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="border-t border-[#E5E7EB] pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                      <div className="text-xs text-text-secondary">
                        <span className="font-bold text-text-primary">{group.members.length} stops</span>
                        <span className="mx-1.5">•</span>
                        <span>{distanceKm.toFixed(1)} km path</span>
                        <span className="mx-1.5">•</span>
                        <span className="font-mono font-bold text-[#2D6A4F]">GHS {totalCarpoolEarnings.toFixed(2)} combined fare</span>
                        <span className="text-gray-400 text-[10px] ml-1.5">(Standalone: GHS {totalStandaloneEarnings.toFixed(2)})</span>
                      </div>

                      <Button
                        variant="primary"
                        className="py-3 px-6 text-sm font-bold shadow-md cursor-pointer shrink-0"
                        isLoading={actionLoading === group.routeGroupId}
                        disabled={!isAvailable}
                        onClick={() => handleAcceptGrouped(group.routeGroupId, reqIds)}
                      >
                        Accept This Route
                      </Button>
                    </div>
                  </Card>
                );
              })}

              {/* Ungrouped single routes */}
              {availableUngrouped.map((req) => {
                const distance = getDistanceKm(myLat, myLng, req.pickupLatitude, req.pickupLongitude);
                const farmerName = req.order?.listing?.farmer?.name || 'Local Farmer';
                const buyerName = req.order?.buyer?.name || 'Buyer';

                return (
                  <Card
                    key={req.id}
                    className="border border-[#E5E7EB] bg-white p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all"
                  >
                    {/* Left: Pickup / dropoff points */}
                    <div className="flex-grow space-y-3.5">
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-start gap-2 text-xs">
                          <span className="w-5 h-5 rounded-full bg-[#EAF4EE] text-[#2D6A4F] font-bold flex items-center justify-center shrink-0">
                            ↑
                          </span>
                          <div>
                            <p className="font-bold text-text-primary">Pickup: {farmerName}</p>
                            <p className="text-text-secondary text-[11px]">
                              {req.order?.listing?.farmer?.district || 'District'}, {req.order?.listing?.farmer?.region || 'Region'}
                              <span className="text-[#2D6A4F] ml-1.5 font-bold">({distance.toFixed(1)} km from you)</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-xs">
                          <span className="w-5 h-5 rounded-full bg-[#FDF2F2] text-[#DC2626] font-bold flex items-center justify-center shrink-0">
                            ↓
                          </span>
                          <div>
                            <p className="font-bold text-text-primary">Dropoff: {buyerName}</p>
                            <p className="text-text-secondary text-[11px]">
                              {req.order?.deliveryAddress || 'Fulfillment Address'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Center: weight + crop */}
                    <div className="md:w-1/4 flex flex-col md:items-center justify-center shrink-0 border-t md:border-t-0 md:border-x border-[#F3F4F6] py-3 md:py-0 px-2">
                      <div className="flex items-center gap-2">
                        <CropTypeBadge cropType={req.order?.listing?.cropType || 'TOMATO'} size="sm" />
                        <span className="text-xs font-bold text-text-primary">
                          {req.order?.quantityKg} kg
                        </span>
                      </div>
                    </div>

                    {/* Right: earnings + accept */}
                    <div className="md:w-1/4 flex items-center justify-between md:flex-col md:items-end justify-center gap-3 shrink-0">
                      <div className="text-left md:text-right space-y-1">
                        <p className="font-mono text-lg font-bold text-[#C8960C]">
                          GHS {(req.estimatedCost || 0).toFixed(2)}
                        </p>
                        <span className="inline-flex px-2 py-0.5 bg-[#EAF4EE] border border-[#2D6A4F]/10 rounded text-[10px] text-[#2D6A4F] font-semibold">
                          Scheduled Pickup
                        </span>
                      </div>

                      <Button
                        variant="primary"
                        size="md"
                        className="font-bold cursor-pointer h-9 px-4"
                        isLoading={actionLoading === req.id}
                        disabled={!isAvailable}
                        onClick={() => handleAcceptSingle(req.id)}
                      >
                        Accept
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* MY JOBS TABS */
        <div key="my-jobs-tab" className="space-y-6">
          {myJobs.length === 0 ? (
            <EmptyState
              title="No jobs accepted"
              description="Browse the available routes dispatch tab to claim cargo matches."
              icon={<Package className="w-10 h-10 text-[#9CA3AF]" />}
              action={
                <Button variant="primary" onClick={() => setActiveTab('available')}>
                  View Available
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {/* Active Jobs in Progress section */}
              {activeJobs.map((job) => {
                const farmerName = job.order?.listing?.farmer?.name || 'Local Farmer';
                const buyerName = job.order?.buyer?.name || 'Buyer';
                const isMatched = job.status === 'MATCHED';
                const isPickedUp = job.status === 'PICKED_UP';

                // Next stop resolution
                const nextStopLabel = isMatched
                  ? `Pickup: ${farmerName}`
                  : `Dropoff: ${buyerName}`;

                const nextStopLat = isMatched ? job.pickupLatitude : job.dropoffLatitude;
                const nextStopLng = isMatched ? job.pickupLongitude : job.dropoffLongitude;

                const routeLineCoords: [number, number][] = [
                  [job.pickupLatitude, job.pickupLongitude],
                  [job.dropoffLatitude, job.dropoffLongitude],
                ];

                return (
                  <Card
                    key={job.id}
                    className="border-l-[4px] border-l-[#2D6A4F] border-y border-r border-[#E5E7EB] bg-white p-5 space-y-5 shadow-card"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-center pb-2.5 border-b border-[#F3F4F6]">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="success" label="In Progress" className="bg-[#EAF4EE] text-[#2D6A4F] font-bold" />
                          {job.isCarpool && (
                            <Badge variant="success" label="Shared Logistics (Carpool)" className="bg-emerald-100 text-emerald-800 font-bold" />
                          )}
                          <span className="font-mono text-[10px] text-text-muted">Batch: {job.order?.listing?.batchCode}</span>
                        </div>
                        <h4 className="text-sm font-bold text-text-primary mt-1 flex items-center justify-between">
                          <span>Active Cargo Dispatch Group</span>
                          <span className="font-mono text-[#C8960C] text-xs">
                            Payout: GHS {(job.isCarpool ? (job.carpoolSplitCost ?? 0) : job.estimatedCost || 0).toFixed(2)}
                          </span>
                        </h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Eye className="w-4 h-4" />}
                        onClick={() => navigate(`/transporter/deliveries/${job.id}`)}
                      >
                        Details
                      </Button>
                    </div>

                    {/* Embedded MiniRouteMap */}
                    <div className="w-full h-[180px] rounded-xl overflow-hidden border border-[#E5E7EB] z-10 relative">
                      <MiniRouteMap
                        job={job}
                        myLat={myLat}
                        myLng={myLng}
                        farmerName={farmerName}
                        buyerName={buyerName}
                      />
                    </div>

                    {/* Ordered stop list sequence */}
                    <div className="space-y-2 text-xs">
                      <p className="font-bold text-text-secondary uppercase tracking-wider text-[10px]">
                        Route Timeline stops
                      </p>
                      
                      <div className="space-y-2">
                        {/* Pickup Stop row */}
                        <div
                          className={`p-3 border rounded-xl flex items-center justify-between transition-colors ${
                            isMatched ? 'bg-[#EAF4EE] border-[#2D6A4F]/20' : 'bg-white border-[#F3F4F6]'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold text-text-primary">Stop 1: Pickup - {farmerName}</p>
                            <p className="text-text-secondary text-[11px]">{job.order?.listing?.farmer?.district}, {job.order?.listing?.farmer?.region}</p>
                          </div>
                          {isMatched ? (
                            <Badge variant="warning" label="NEXT STOP" size="sm" />
                          ) : (
                            <span className="text-[#2D6A4F] font-bold text-xs flex items-center gap-1">
                              ✓ Completed
                            </span>
                          )}
                        </div>

                        {/* Dropoff Stop row */}
                        <div
                          className={`p-3 border rounded-xl flex items-center justify-between transition-colors ${
                            isPickedUp ? 'bg-[#EAF4EE] border-[#2D6A4F]/20' : 'bg-white border-[#F3F4F6]'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold text-text-primary">Stop 2: Dropoff - {buyerName}</p>
                            <p className="text-text-secondary text-[11px]">{job.order?.deliveryAddress}</p>
                          </div>
                          {isPickedUp ? (
                            <Badge variant="warning" label="NEXT STOP" size="sm" />
                          ) : (
                            <span className="text-[#9CA3AF] text-xs">Pending pickup</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons panel */}
                    <div className="border-t border-[#E5E7EB] pt-4 flex flex-col sm:flex-row gap-3">
                      {isMatched && (
                        <Button
                          variant="primary"
                          className="flex-grow font-bold py-3 text-sm h-11"
                          isLoading={actionLoading === job.id}
                          onClick={() => handleUpdateStatus(job.id, 'PICKED_UP')}
                        >
                          Mark as Picked Up
                        </Button>
                      )}

                      {isPickedUp && (
                        <Button
                          variant="primary"
                          className="flex-grow font-bold py-3 text-sm h-11"
                          isLoading={actionLoading === job.id}
                          onClick={() => handleUpdateStatus(job.id, 'DELIVERED')}
                        >
                          Mark as Delivered
                        </Button>
                      )}

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${nextStopLat},${nextStopLng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#E5E7EB] hover:bg-[#EAF4EE] text-text-primary font-bold rounded-lg text-sm shrink-0 select-none cursor-pointer h-11"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Navigate ({nextStopLabel.split(':')[0]})</span>
                      </a>
                    </div>
                  </Card>
                );
              })}

              {/* Completed Jobs section */}
              {completedJobs.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[#F3F4F6]">
                  <h4 className="text-sm font-bold text-[#111827] uppercase tracking-wider text-[10px]">
                    Completed Routes History
                  </h4>

                  <div className="space-y-3">
                    {completedJobs.map((job) => (
                      <Card
                        key={job.id}
                        className="bg-white border border-[#E5E7EB] p-4 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-4.5 h-4.5 rounded-full bg-[#EAF4EE] text-[#2D6A4F] font-bold flex items-center justify-center text-[10px]">
                              ✓
                            </span>
                            <span className="font-bold text-text-primary">
                              Pickup: {job.order?.listing?.farmer?.name} → Dropoff: {job.order?.buyer?.name}
                            </span>
                          </div>
                          <p className="text-text-secondary text-[11px] pl-6">
                            Delivered {new Date(job.updatedAt).toLocaleDateString()} at{' '}
                            {new Date(job.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="text-right flex flex-col items-end">
                          <span className="font-mono text-sm font-bold text-[#2D6A4F]">
                            +GHS {(job.carpoolSplitCost || job.estimatedCost || 0).toFixed(2)}
                          </span>
                          {job.isCarpool && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-medium mt-0.5">
                              Carpool Split
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TransportDashboardPage;
