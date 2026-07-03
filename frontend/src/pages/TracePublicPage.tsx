import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Copy, CheckCircle, Share2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TraceApi } from '../api/trace.api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

// Skeleton Component for loading states
const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-[#F3F4F6] rounded-xl ${className}`} />
);

export const TracePublicPage: React.FC = () => {
  const { batchCode } = useParams<{ batchCode: string }>();

  // Map DOM element references
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);

  // Fetch public traceability data
  const { data, isLoading, error } = useQuery({
    queryKey: ['trace', batchCode],
    queryFn: () => TraceApi.getTraceByBatchCode(batchCode || ''),
    enabled: !!batchCode,
    retry: false,
  });

  // Direct Leaflet Map initialization and cleanup hook
  React.useEffect(() => {
    if (!mapRef.current || !data) return;

    // Remove any previous map instance associated with this ref
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const container = mapRef.current;
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    try {
      const map = L.map(container, {
        center: [data.latitude, data.longitude],
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      L.circle([data.latitude, data.longitude], {
        color: '#2D6A4F',
        fillColor: '#2D6A4F',
        fillOpacity: 0.12,
        weight: 1.5,
        radius: 2500, // 2.5km privacy blur radius
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
  }, [data]);

  const handleCopyBatchCode = () => {
    if (!batchCode) return;
    navigator.clipboard.writeText(batchCode);
    toast.success('Batch code copied to clipboard!');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Trace page link copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white py-12 px-4 flex flex-col items-center">
        <div className="w-full max-w-[680px] space-y-6">
          <div className="h-14 border-b border-[#E5E7EB] flex justify-between items-center pb-4">
            <SkeletonCard className="w-28 h-6" />
            <SkeletonCard className="w-36 h-8" />
          </div>
          <div className="flex flex-col items-center py-8 space-y-4">
            <SkeletonCard className="w-16 h-16 rounded-full" />
            <SkeletonCard className="w-48 h-8" />
            <SkeletonCard className="w-32 h-5" />
            <SkeletonCard className="w-24 h-6" />
          </div>
          <SkeletonCard className="w-full h-32" />
          <SkeletonCard className="w-full h-64" />
          <SkeletonCard className="w-full h-48" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white py-12 px-4 flex flex-col items-center justify-center">
        <div className="text-center max-w-md space-y-6">
          <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto text-[#DC2626]">
            <Search size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-text-primary">Batch Code Not Found</h2>
            <p className="text-sm text-text-secondary">
              We couldn't retrieve traceability records for the batch code <span className="font-mono font-bold text-text-primary">"{batchCode}"</span>. Please check the code and try again.
            </p>
          </div>
          <div>
            <Link to="/" className="btn btn-primary h-11 w-full text-center">
              Go to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Format crop displays
  const getCropDisplay = (crop: string) => {
    switch (crop.toUpperCase()) {
      case 'TOMATO': return { name: 'Fresh Tomatoes', emoji: '🍅' };
      case 'PEPPER': return { name: 'Habanero Peppers', emoji: '🫑' };
      case 'OKRA': return { name: 'Fresh Okra', emoji: '🥬' };
      case 'GARDEN_EGG': return { name: 'Garden Egg', emoji: '🍆' };
      case 'LEAFY_GREENS': return { name: 'Leafy Greens', emoji: '🥬' };
      default: return { name: crop, emoji: '🥦' };
    }
  };

  const crop = getCropDisplay(data.cropType);

  const getGradeBadge = (grade: string) => {
    const display = grade.replace('GRADE_', '');
    if (grade === 'GRADE_A') {
      return <Badge variant="success" label={`Grade ${display}`} className="bg-[#EAF4EE] text-[#2D6A4F] font-bold" />;
    }
    if (grade === 'GRADE_B') {
      return <Badge variant="warning" label={`Grade ${display}`} className="bg-[#FEF9EC] text-[#C8960C] font-bold" />;
    }
    return <Badge variant="neutral" label={`Grade ${display}`} className="bg-gray-100 text-text-secondary" />;
  };

  const getEventLabel = (type: string) => {
    switch (type.toUpperCase()) {
      case 'HARVESTED': return 'Harvested';
      case 'LISTED': return 'Listed on AgriConnect';
      case 'QUALITY_CHECKED': return `Quality Assessed: Grade ${data.qualityGrade.replace('GRADE_', '')}`;
      case 'RESERVED': return 'Order Placed';
      case 'PICKED_UP': return 'Picked Up for Delivery';
      case 'IN_TRANSIT': return 'In Transit';
      case 'DELIVERED': return 'Delivered ✓';
      default: return type;
    }
  };

  const getFutureEventLabel = (type: string) => {
    switch (type.toUpperCase()) {
      case 'HARVESTED': return 'Harvested';
      case 'LISTED': return 'Listed on AgriConnect';
      case 'QUALITY_CHECKED': return 'Quality Assessed';
      case 'RESERVED': return 'Order Placed';
      case 'PICKED_UP': return 'Picked Up for Delivery';
      case 'IN_TRANSIT': return 'In Transit';
      case 'DELIVERED': return 'Delivered';
      default: return type;
    }
  };

  // Timeline ordering sequence
  const eventSequence = [
    'HARVESTED',
    'LISTED',
    'QUALITY_CHECKED',
    'RESERVED',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED'
  ];

  const latestEvent = data.timeline[data.timeline.length - 1];
  const latestType = latestEvent?.eventType || 'HARVESTED';
  const latestIndex = eventSequence.indexOf(latestType);
  const futureEvents = latestIndex !== -1 ? eventSequence.slice(latestIndex + 1) : [];

  const farmerInitial = data.farmer?.name ? data.farmer.name.charAt(0) : '';

  return (
    <div className="min-h-screen bg-white py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-[680px] space-y-8 bg-white">
        
        {/* Top Brand Bar */}
        <div className="flex justify-between items-center pb-4 border-b border-[#E5E7EB] bg-white">
          <Link to="/" className="text-xl font-bold text-[#2D6A4F] tracking-tight font-display">
            AgriConnect
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EAF4EE] text-[#2D6A4F] border border-[#2D6A4F]/20 select-none">
            <ShieldCheck size={14} className="shrink-0" />
            Verified Produce Trace
          </div>
        </div>

        {/* Hero Certificate Header */}
        <div className="text-center py-6 flex flex-col items-center space-y-3.5 bg-white">
          <span className="text-5xl" role="img" aria-label={crop.name}>
            {crop.emoji}
          </span>
          <h2 className="text-[28px] font-extrabold text-[#111827] tracking-tight font-display">
            {crop.name}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-sm font-semibold text-[#6B7280]">
              {data.batchCode}
            </span>
            <button
              onClick={handleCopyBatchCode}
              title="Copy batch code"
              className="text-[#9CA3AF] hover:text-[#2D6A4F] transition-colors p-1.5 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-150"
            >
              <Copy size={14} />
            </button>
          </div>
          <div>
            {getGradeBadge(data.qualityGrade)}
          </div>
        </div>

        {/* Origin Card */}
        <Card className="p-5 border border-[#E5E7EB] shadow-card bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base select-none">🇬🇭</span>
              <p className="text-sm font-bold text-text-primary">
                Grown by {farmerInitial}. in {data.farmer?.region}, Ghana
              </p>
            </div>
            {data.plantingDate && (
              <p className="text-xs text-text-secondary font-medium pl-6">
                Planted {new Date(data.plantingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Harvested {new Date(data.harvestDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
          <div className="shrink-0 px-3 py-1 bg-[#EAF4EE] text-[#2D6A4F] text-xs font-semibold rounded-md border border-[#2D6A4F]/10">
            Harvested {new Date(data.harvestDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </Card>

        {/* Timeline Journey */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-[#111827] tracking-tight">
            Journey from Farm to Buyer
          </h3>

          <div className="relative border-l-2 border-[#E5E7EB] ml-3 pl-8 space-y-8">
            {/* Occurred timeline items */}
            {data.timeline.map((event, index) => {
              const isCurrent = index === data.timeline.length - 1;
              return (
                <div key={index} className="relative group">
                  {/* Timeline Dot icon */}
                  <span className="absolute -left-[41px] top-1.5 flex items-center justify-center bg-white rounded-full">
                    {isCurrent ? (
                      <span className="relative flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D6A4F]/30 opacity-75 ring-4 ring-[#2D6A4F]/20"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2D6A4F]"></span>
                      </span>
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-[#2D6A4F]" />
                    )}
                  </span>
                  
                  <div className="space-y-1">
                    <p className={`text-sm font-bold ${isCurrent ? 'text-[#2D6A4F]' : 'text-text-primary'}`}>
                      {getEventLabel(event.eventType)}
                    </p>
                    <p className="text-[11px] font-medium text-[#9CA3AF]">
                      {new Date(event.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {event.notes && (
                      <p className="text-[13px] text-text-secondary leading-relaxed pt-0.5 max-w-xl">
                        {event.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Future placeholders */}
            {futureEvents.map((type, index) => (
              <div key={index} className="relative opacity-60">
                {/* Hollow circle dot */}
                <span className="absolute -left-[40px] top-1.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center bg-white rounded-full">
                  <span className="h-3 w-3 rounded-full border-2 border-[#E5E7EB] bg-white" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[#9CA3AF] pl-0.5">
                    {getFutureEventLabel(type)}
                  </p>
                  <p className="text-[10px] text-[#D1D5DB] pl-0.5 font-medium">Pending progress</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Approximate Privacy Map */}
        <Card className="p-5 border border-[#E5E7EB] shadow-card bg-white space-y-4">
          <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider text-[10px] text-text-secondary">
            Estimated Farm Region
          </h4>
          <div className="w-full h-[240px] rounded-xl overflow-hidden border border-[#E5E7EB] z-10 relative">
            <div 
              ref={mapRef}
              className="w-full h-full"
            />
          </div>
          <p className="text-xs font-semibold text-text-secondary text-center pt-1">
            📍 Farm origin: {data.farmer?.region}, {data.farmer?.district}
          </p>
        </Card>

        {/* Inputs Used */}
        {data.inputsUsed && data.inputsUsed.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[13px] font-bold text-text-secondary uppercase tracking-wider text-[10px]">
              Grown with:
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.inputsUsed.map((input, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-[#EAF4EE] text-[#2D6A4F] text-xs font-semibold rounded-full border border-[#2D6A4F]/10 shadow-sm"
                >
                  🌱 {input}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Delivery Confirmation */}
        {data.deliveryInfo && (
          <Card className="p-5 border border-l-[4px] border-l-[#2D6A4F] border-y border-r border-[#E5E7EB] shadow-card bg-white flex items-start gap-4">
            <div className="p-2 bg-[#EAF4EE] text-[#2D6A4F] rounded-lg">
              <CheckCircle size={22} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-text-primary">
                Delivered Successfully
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Delivered to a <span className="font-bold text-[#2D6A4F] capitalize">{data.deliveryInfo.buyerType.toLowerCase()}</span> on{' '}
                {new Date(data.deliveryInfo.deliveredAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </Card>
        )}

        {/* Footer actions */}
        <div className="pt-8 border-t border-[#E5E7EB] space-y-6 text-center">
          <p className="text-xs text-[#9CA3AF] font-medium leading-relaxed max-w-sm mx-auto">
            This traceability record is created and verified by AgriConnect.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button
              variant="secondary"
              leftIcon={<Share2 size={16} />}
              onClick={handleShare}
              className="h-11 cursor-pointer"
            >
              Share Record
            </Button>
            {data.status === 'AVAILABLE' && (
              <Link
                to={`/login?redirect=/buyer/listings/${data.id}`}
                className="btn btn-primary h-11 px-6 shadow-sm cursor-pointer"
              >
                Order this produce
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
export default TracePublicPage;
