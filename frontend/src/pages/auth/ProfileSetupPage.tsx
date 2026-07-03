import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthApi } from '../../api/auth.api';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Eastern',
  'Western',
  'Northern',
  'Volta',
  'Central',
  'Bono',
  'Bono East',
  'Ahafo',
  'Upper East',
  'Upper West',
  'Oti',
  'Savannah',
  'North East',
  'Western North',
];

export const ProfileSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [name, setName] = useState('');
  const [region, setRegion] = useState(GHANA_REGIONS[0]);
  const [district, setDistrict] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [locating, setLocating] = useState(false);

  // Role specific state parameters
  const [vehicleType, setVehicleType] = useState('');
  const [capacityKg, setCapacityKg] = useState('100');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('15');
  const [businessType, setBusinessType] = useState('RETAILER');

  // Mutation for updating profile
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return AuthApi.updateProfile(data);
    },
    onSuccess: (updatedUser) => {
      // Re-hydrate state context in AuthContext
      const storedToken = localStorage.getItem('token') || '';
      login(storedToken, updatedUser);

      toast.success('Profile completed successfully!');
      navigate('/');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save profile. Please try again.');
    },
  });

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setLocating(false);
        toast.success('Coordinates captured successfully!');
      },
      (error) => {
        console.error(error);
        setLocating(false);
        toast.error('Failed to retrieve location. Please permit GPS access.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error('Please enter your full name');
      return;
    }

    const payload: any = {
      name,
      region,
      district: district || undefined,
      latitude: lat,
      longitude: lng,
    };

    if (user?.role === 'TRANSPORT') {
      payload.vehicleType = vehicleType || 'N/A';
      payload.capacityKg = parseFloat(capacityKg) || 0;
      payload.serviceRadiusKm = parseFloat(serviceRadiusKm) || 15;
    } else if (user?.role === 'BUYER') {
      payload.businessType = businessType;
    }

    updateProfileMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      {/* 420px center-card matching specification */}
      <Card className="w-full max-w-[420px] p-6 space-y-6">
        <div className="space-y-1 bg-white">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight font-display">
            Complete your profile
          </h2>
          <p className="text-sm text-text-secondary">
            Help buyers and farmers know who they're working with
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <Input
            label="Full Name"
            type="text"
            required
            placeholder="e.g. Ama Serwaa"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Region Selector */}
          <Select
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            {GHANA_REGIONS.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </Select>

          {/* District Selector */}
          <Input
            label="District (Optional)"
            type="text"
            placeholder="e.g. Accra Metropolitan"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />

          {/* Location Capture Button */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-sm font-semibold text-text-secondary">GPS Coordinates</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCaptureLocation}
                isLoading={locating}
                className="flex-1 text-xs"
              >
                Use my location
              </Button>
              {lat && lng && (
                <div className="flex items-center justify-center px-3 border border-border rounded-btn text-[11px] font-mono text-primary font-bold bg-[#EAF4EE]">
                  Captured
                </div>
              )}
            </div>
            {lat && lng && (
              <span className="text-[10px] text-text-muted font-mono block">
                Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
              </span>
            )}
          </div>

          {/* TRANSPORT specific details */}
          {user?.role === 'TRANSPORT' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Transport Profile Details</p>
              <Input
                label="Vehicle Type"
                type="text"
                required
                placeholder="e.g. Refrigerated Box Truck, Motorbike"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
              />
              <Input
                label="Capacity (kg)"
                type="number"
                required
                min="1"
                placeholder="e.g. 500"
                value={capacityKg}
                onChange={(e) => setCapacityKg(e.target.value)}
              />
              <Input
                label="Service Radius (km)"
                type="number"
                required
                min="1"
                placeholder="15"
                value={serviceRadiusKm}
                onChange={(e) => setServiceRadiusKm(e.target.value)}
              />
            </div>
          )}

          {/* BUYER specific details */}
          {user?.role === 'BUYER' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Buyer Profile Details</p>
              <Select
                label="Business Type"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              >
                <option value="RETAILER">Retailer</option>
                <option value="RESTAURANT">Restaurant</option>
                <option value="PROCESSOR">Processor</option>
                <option value="EXPORTER">Exporter</option>
                <option value="HOUSEHOLD">Household</option>
              </Select>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            isLoading={updateProfileMutation.isPending}
            className="mt-4"
          >
            Save and Continue
          </Button>
        </form>
      </Card>
    </div>
  );
};
export default ProfileSetupPage;
