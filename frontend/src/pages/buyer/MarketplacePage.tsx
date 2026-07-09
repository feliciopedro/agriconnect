import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ListingsApi } from '../../api/listings.api';
import type { ProduceListing } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CropTypeBadge } from '../../components/ui/CropTypeBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import {
  Search,
  SlidersHorizontal,
  Grid,
  Map as MapIcon,
  Leaf,
  X,
  MapPin,
  Star,
  SearchX,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Map center update hook
const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 12);
  }, [center, map]);
  return null;
};

// SVG Div Icons for Leaflet (removes default PNG path issues in Vite builds)
const createListingIcon = (cropType: string) => {
  let emoji = '🌱';
  if (cropType === 'TOMATO') emoji = '🍅';
  else if (cropType === 'PEPPER') emoji = '🌶️';
  else if (cropType === 'GARDEN_EGG') emoji = '🍆';
  else if (cropType === 'OKRA') emoji = '🥬';
  else if (cropType === 'LEAFY_GREENS') emoji = '🥦';

  return L.divIcon({
    html: `<div class="w-8 h-8 rounded-full bg-[#2D6A4F] border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"><span class="text-base">${emoji}</span></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const userIcon = L.divIcon({
  html: `<div class="w-5 h-5 rounded-full bg-[#2563EB] border-2 border-white shadow-xl flex items-center justify-center"><div class="w-2.5 h-2.5 bg-white rounded-full animate-ping"></div></div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Helper for GPS distance calculation (Haversine formula)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
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

export const MarketplacePage: React.FC = () => {
  useAuth();
  const navigate = useNavigate();

  // Search & Basic states
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCropCategory, setSelectedCropCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Filters Drawer States
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [maxDistance, setMaxDistance] = useState<string>('Any'); // 5km, 10km, 20km, Any
  const [minQuantity, setMinQuantity] = useState<string>('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);

  // Geolocation states (Default: Accra center coordinates)
  const [userLat, setUserLat] = useState<number>(5.6037);
  const [userLng, setUserLng] = useState<number>(-0.187);
  const [nearMeActive, setNearMeActive] = useState<boolean>(false);

  const fetchListings = async () => {
    setLoading(true);
    try {
      // Query parameters for ListingsApi
      const filters: any = {};
      if (selectedCropCategory !== 'All') {
        filters.cropType = selectedCropCategory.toUpperCase().replace(' ', '_');
      }
      
      // Let's call ListingsApi search
      const res = await ListingsApi.getListings(filters);
      setListings(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to fetch marketplace listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [selectedCropCategory]);

  // Request user GPS location
  const handleNearMeToggle = () => {
    if (nearMeActive) {
      setNearMeActive(false);
      // Reset coordinates to default
      setUserLat(5.6037);
      setUserLng(-0.187);
      toast.success('Location filter disabled');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLat(position.coords.latitude);
        setUserLng(position.coords.longitude);
        setNearMeActive(true);
        toast.success('Marketplace sorted by proximity to you!');
      },
      (error) => {
        console.error(error);
        toast.error('Failed to capture location. Sorting defaults to center of Accra.');
      }
    );
  };

  const handleGradeToggle = (grade: string) => {
    if (selectedGrades.includes(grade)) {
      setSelectedGrades(selectedGrades.filter((g) => g !== grade));
    } else {
      setSelectedGrades([...selectedGrades, grade]);
    }
  };

  // Perform full frontend filtering & search keywords matching
  const getFilteredListings = () => {
    return listings.filter((listing) => {
      // 1. Search Query keyword mapping
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const cropMatch = listing.cropType.toLowerCase().includes(query);
        const titleMatch = (listing.title || '').toLowerCase().includes(query);
        const farmerNameMatch = (listing.farmer?.name || '').toLowerCase().includes(query);
        if (!cropMatch && !titleMatch && !farmerNameMatch) {
          return false;
        }
      }

      // 2. Proximity filter
      if (nearMeActive && maxDistance !== 'Any') {
        const dist = getDistanceKm(userLat, userLng, listing.latitude, listing.longitude);
        const limit = parseFloat(maxDistance);
        if (dist > limit) return false;
      }

      // 3. Price Filter
      const price = listing.pricePerKg;
      if (minPrice && price < parseFloat(minPrice)) return false;
      if (maxPrice && price > parseFloat(maxPrice)) return false;

      // 4. Quantity Min
      if (minQuantity && listing.remainingKg < parseFloat(minQuantity)) return false;

      // 5. Quality Grade Checklist
      if (selectedGrades.length > 0) {
        const grade = listing.qualityGrade || 'UNGRADED';
        if (!selectedGrades.includes(grade)) return false;
      }

      // Hide expired status listings unless reserved
      return listing.status === 'AVAILABLE' || listing.status === 'RESERVED';
    });
  };

  const clearAllFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setMaxDistance('Any');
    setMinQuantity('');
    setSelectedGrades([]);
    setSearchQuery('');
    setNearMeActive(false);
    toast.success('Filters cleared');
  };

  const filteredListings = getFilteredListings();

  // If sorting by "Near Me", we sort the results by distance
  if (nearMeActive) {
    filteredListings.sort((a, b) => {
      const distA = getDistanceKm(userLat, userLng, a.latitude, a.longitude);
      const distB = getDistanceKm(userLat, userLng, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  return (
    <div className="bg-white min-h-screen pb-12 relative overflow-x-hidden">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] py-3.5 px-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto shrink-0">
            <h1 className="text-xl font-bold tracking-tight text-[#111827] font-display">
              Marketplace
            </h1>
            {/* View toggle for mobile */}
            <div className="flex md:hidden border border-[#E5E7EB] rounded-lg p-0.5 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'text-[#2D6A4F] bg-[#EAF4EE]' : 'text-[#9CA3AF]'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-1.5 rounded ${viewMode === 'map' ? 'text-[#2D6A4F] bg-[#EAF4EE]' : 'text-[#9CA3AF]'}`}
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="w-full md:max-w-md flex-1 relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search crop types, titles, or farmers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input w-full pl-10 pr-9 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 rounded-full text-[#9CA3AF] hover:bg-gray-100 hover:text-[#111827]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle pill & Filter trigger */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
            <button
              onClick={handleNearMeToggle}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                nearMeActive
                  ? 'bg-[#EAF4EE] border-[#2D6A4F] text-[#2D6A4F]'
                  : 'bg-white border-[#E5E7EB] text-[#6B7280]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Near Me</span>
            </button>
 
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
              onClick={() => setDrawerOpen(true)}
            >
              Filters
            </Button>
 
            {/* View toggle desktop */}
            <div className="hidden md:flex border border-[#E5E7EB] rounded-lg p-0.5 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded cursor-pointer ${viewMode === 'grid' ? 'text-[#2D6A4F] bg-[#EAF4EE]' : 'text-[#9CA3AF]'}`}
              >
                <Grid className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-2 rounded cursor-pointer ${viewMode === 'map' ? 'text-[#2D6A4F] bg-[#EAF4EE]' : 'text-[#9CA3AF]'}`}
              >
                <MapIcon className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Crop filter strip */}
      <div className="py-4 overflow-x-auto flex gap-2 -mx-4 px-4 scrollbar-hide select-none">
        {['All', 'Tomato', 'Pepper', 'Garden Egg', 'Okra', 'Leafy Greens'].map((category) => {
          const isActive = selectedCropCategory === category;
          return (
            <button
              key={category}
              onClick={() => setSelectedCropCategory(category)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-full border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#EAF4EE] border-[#2D6A4F] text-[#2D6A4F] font-bold shadow-sm'
                  : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-gray-300'
              }`}
            >
              {category === 'All' ? '🚜 All Produce' : category}
            </button>
          );
        })}
      </div>

      {/* Results details strip */}
      <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6] mb-6">
        <span className="text-[13px] text-[#6B7280] font-medium">
          {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''} found
          {nearMeActive ? ' near you' : ''}
        </span>
        {nearMeActive && (
          <span className="text-xs text-[#2D6A4F] font-semibold flex items-center gap-1">
            <CheckCircle2Icon className="w-3.5 h-3.5" /> GPS Active
          </span>
        )}
      </div>

      {/* Grid vs Map View Render */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse flex flex-col space-y-3 bg-white overflow-hidden">
              <div className="w-full h-[180px] bg-[#E5E7EB] rounded-t-[10px] -mx-4 -mt-4 sm:-mx-5 sm:-mt-5" />
              <div className="h-3.5 bg-[#E5E7EB] rounded w-1/3 mt-2" />
              <div className="h-5 bg-[#E5E7EB] rounded w-2/3" />
              <div className="h-3.5 bg-[#E5E7EB] rounded w-1/2" />
              <div className="h-3.5 bg-[#E5E7EB] rounded w-2/5 mt-auto" />
            </Card>
          ))}
        </div>
      ) : filteredListings.length === 0 ? (
        <EmptyState
          title="No produce matches your filters"
          description="Try clearing your filters or search terms to see more listings."
          icon={<SearchX className="w-12 h-12 text-[#9CA3AF]" />}
          action={
            <Button variant="secondary" onClick={clearAllFilters}>
              Clear All Filters
            </Button>
          }
        />
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => {
            const distance = getDistanceKm(userLat, userLng, listing.latitude, listing.longitude);
            const fresh = getFreshnessInfo(listing.harvestDate, listing.expiryEstimate);
            const hasImage = listing.images && listing.images.length > 0;
            const imageUrl = hasImage
              ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/../${listing.images[0]}`
              : null;

            // Farmer details
            const farmerName = listing.farmer?.name || 'Local Farmer';
            const farmerInitials = farmerName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <Card
                key={listing.id}
                clickable
                onClick={() => navigate(`/marketplace/listings/${listing.id}`)}
                className="flex flex-col h-full bg-white group border border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:border-[#2D6A4F] hover:shadow-[0_2px_8px_rgba(45,106,79,0.12)] transition-all duration-200 overflow-hidden"
              >
                {/* Product cover photo */}
                <div className="relative w-full h-[180px] bg-[#EAF4EE] -mx-4 -mt-4 sm:-mx-5 sm:-mt-5 overflow-hidden flex items-center justify-center border-b border-[#E5E7EB]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={listing.cropType}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 rounded-t-[10px]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                        (e.target as HTMLImageElement).className = 'hidden';
                      }}
                    />
                  ) : null}
                  {!imageUrl && <Leaf className="w-12 h-12 text-[#2D6A4F]" />}

                  {/* Top-Right Badge: Quality Grade */}
                  {listing.qualityGrade && listing.qualityGrade !== 'UNGRADED' && (
                    <div className="absolute top-3 right-3 shadow">
                      <Badge variant="warning" size="sm" label={`Grade ${listing.qualityGrade}`} />
                    </div>
                  )}
                </div>

                {/* Body metadata */}
                <div className="flex-grow pt-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    {/* Row: CropTypeBadge + Distance */}
                    <div className="flex items-center justify-between">
                      <CropTypeBadge cropType={listing.cropType} size="sm" />
                      <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-[#6B7280] font-semibold rounded-full border border-gray-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> ~{distance.toFixed(1)} km
                      </span>
                    </div>

                    {/* Crop name title */}
                    <h3 className="text-base font-semibold text-[#111827] line-clamp-1 leading-snug">
                      {listing.title || listing.cropType.replace('_', ' ')}
                    </h3>

                    {/* Farmer initials avatar + name + stars */}
                    <div className="flex items-center gap-2">
                      <div className="w-6.5 h-6.5 rounded-full bg-[#2D6A4F] text-white font-bold text-[10px] flex items-center justify-center shrink-0 border border-white">
                        {farmerInitials}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-text-primary leading-none">
                          {farmerName}
                        </span>
                        <div className="flex items-center text-[10px] text-amber-500 mt-0.5 leading-none">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className="w-2.5 h-2.5 fill-current" />
                          ))}
                          <span className="text-text-secondary ml-1">(5.0)</span>
                        </div>
                      </div>
                    </div>

                    {/* Price details in Monospace Gold */}
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="font-mono text-[20px] font-bold text-[#C8960C]">
                        GHS {listing.pricePerKg.toFixed(2)} <span className="text-xs font-normal text-text-secondary">/ kg</span>
                      </span>
                      <span className="text-xs font-semibold text-[#6B7280]">
                        {listing.remainingKg} kg available
                      </span>
                    </div>

                    {/* Freshness Bar */}
                    <div className="space-y-1 pt-1.5 border-t border-[#F3F4F6]">
                      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${fresh.colorClass}`}
                          style={{ width: `${(1 - fresh.percentage) * 100}%` }}
                        />
                      </div>
                      <p className={`text-[10px] truncate ${fresh.textColorClass}`}>
                        {fresh.text}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer action button */}
                  <div className="border-t border-[#E5E7EB] pt-3">
                    <Button
                      variant="primary"
                      fullWidth
                      size="md"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/marketplace/listings/${listing.id}`);
                      }}
                    >
                      Order Now
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Map view container */
        <div className="w-full h-[520px] rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-card relative">
          <MapContainer
            center={[userLat, userLng]}
            zoom={12}
            className="w-full h-full z-10"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Recenter hook */}
            <RecenterMap center={[userLat, userLng]} />

            {/* Current user coordinates marker */}
            <Marker position={[userLat, userLng]} icon={userIcon}>
              <Popup>
                <div className="text-center font-semibold text-xs text-[#2563EB]">
                  Your Location
                </div>
              </Popup>
            </Marker>

            {filteredListings.map((listing) => {
              const distance = getDistanceKm(userLat, userLng, listing.latitude, listing.longitude);
              return (
                <Marker
                  key={listing.id}
                  position={[listing.latitude, listing.longitude]}
                  icon={createListingIcon(listing.cropType)}
                >
                  <Popup>
                    <div className="w-[200px] text-xs space-y-2">
                      <CropTypeBadge cropType={listing.cropType} size="sm" />
                      <h4 className="font-bold text-text-primary leading-tight">
                        {listing.title || listing.cropType.replace('_', ' ')}
                      </h4>
                      <p className="font-mono text-sm text-[#C8960C] font-semibold">
                        GHS {listing.pricePerKg.toFixed(2)} / kg
                      </p>
                      <p className="text-[11px] text-text-secondary leading-none">
                        Remaining: {listing.remainingKg} kg · ~{distance.toFixed(1)} km away
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5 leading-none">
                        Expires in: {new Date(listing.expiryEstimate || '').toLocaleDateString()}
                      </p>
                      <div className="pt-2 border-t border-border-default">
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          onClick={() => navigate(`/marketplace/listings/${listing.id}`)}
                        >
                          Order Details
                        </Button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      {/* Filters side Drawer */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop overlay */}
        <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />

        {/* Core Drawer Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-full sm:max-w-md bg-white shadow-2xl z-10 flex flex-col justify-between transition-transform duration-300 ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-5 h-5 text-[#2D6A4F]" />
              <h2 className="text-lg font-bold text-[#111827] font-display">Filters</h2>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-full text-[#9CA3AF] hover:bg-gray-100 hover:text-[#111827]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-grow overflow-y-auto p-5 space-y-6">
            {/* Price Range */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">Price Range (GHS/kg)</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span className="text-text-muted">—</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Distance Choice */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#6B7280]">Distance Radius</label>
              <div className="grid grid-cols-2 gap-2.5">
                {['5', '10', '20', 'Any'].map((dist) => (
                  <label
                    key={dist}
                    className={`flex items-center justify-center p-2.5 border rounded-card text-xs font-semibold cursor-pointer select-none transition-colors ${
                      maxDistance === dist
                        ? 'border-[#2D6A4F] bg-[#EAF4EE] text-[#2D6A4F]'
                        : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="distanceFilter"
                      value={dist}
                      checked={maxDistance === dist}
                      onChange={() => setMaxDistance(dist)}
                      className="sr-only"
                    />
                    <span>{dist === 'Any' ? 'Any Distance' : `< ${dist} km`}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Minimum quantity */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">Minimum Quantity (kg)</label>
              <Input
                type="number"
                placeholder="e.g. 20"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
              />
            </div>

            {/* Quality grade checklist */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">Quality Grade</label>
              <div className="flex flex-col gap-2">
                {['A', 'B', 'C', 'UNGRADED'].map((grade) => {
                  const isChecked = selectedGrades.includes(grade);
                  return (
                    <label
                      key={grade}
                      className="flex items-center gap-2.5 text-xs text-text-primary cursor-pointer select-none py-1"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleGradeToggle(grade)}
                        className="rounded border-[#D1D5DB] text-[#2D6A4F] focus:ring-[#2D6A4F] w-4 h-4 cursor-pointer"
                      />
                      <span>Grade {grade === 'UNGRADED' ? 'Ungraded' : grade}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-[#E5E7EB] bg-white flex items-center justify-between gap-3 shadow">
            <Button variant="ghost" className="flex-1" onClick={clearAllFilters}>
              Clear All
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setDrawerOpen(false)}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Internal icon wrapper
const CheckCircle2Icon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default MarketplacePage;
