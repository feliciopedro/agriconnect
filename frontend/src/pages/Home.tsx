import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Leaf,
  ShoppingBag,
  Truck,
  MapPin,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Mail,
  Zap,
} from 'lucide-react';

interface MockListing {
  id: string;
  type: 'crop' | 'buyer' | 'transport';
  title: string;
  user: string;
  location: string;
  detail: string;
  extra?: string;
  price?: string;
}

// ─── SaaS Landing Preview Widgets ──────────────────────────────────────────

const HeroPreview: React.FC = () => {
  return (
    <div className="relative w-full min-h-[380px] lg:min-h-[440px] flex items-center justify-center select-none">
      {/* Background blobs */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-emerald-300/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-amber-300/10 rounded-full blur-3xl" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:16px_16px] opacity-60" />

      {/* Box 1: Glassmorphic Produce Passport Card */}
      <div className="absolute top-4 left-6 sm:left-12 w-[240px] sm:w-[280px] bg-white/85 backdrop-blur-md border border-[#E5E7EB] rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transform -rotate-3 hover:rotate-0 transition-transform duration-300 z-20">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍅</span>
            <div>
              <p className="text-xs font-bold text-text-primary">Vine Tomatoes</p>
              <p className="text-[10px] text-text-secondary">Batch #BAT-TOM-482</p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-[#EAF4EE] text-[#2D6A4F] text-[9px] font-bold rounded-full border border-[#2D6A4F]/20">
            GRADE A
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Farmer</span>
            <span className="font-semibold text-text-primary">E. Gyamfi (Ada)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Shelf Life</span>
            <span className="text-[#2D6A4F] font-bold">5 Days remaining</span>
          </div>
          <div className="flex justify-between border-t border-gray-50 pt-2">
            <span className="text-[#9CA3AF]">Blockchain Stamp</span>
            <span className="font-mono text-[9px] bg-gray-50 px-1.5 py-0.5 text-text-secondary rounded">
              0x42f8...9b1a
            </span>
          </div>
        </div>

        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3.5">
          <div className="w-4/5 h-full bg-[#2D6A4F]" />
        </div>
      </div>

      {/* Box 2: Glassmorphic Delivery Route Card */}
      <div className="absolute bottom-6 right-6 sm:right-12 w-[250px] sm:w-[290px] bg-white/90 backdrop-blur-md border border-[#E5E7EB] rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] transform rotate-2 hover:rotate-0 transition-transform duration-300 z-30">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚚</span>
            <div>
              <p className="text-xs font-bold text-text-primary">Logistics Routing</p>
              <p className="text-[10px] text-text-secondary">Ada → Accra Market</p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-[#FEF9EC] text-[#C8960C] text-[9px] font-bold rounded-full border border-[#C8960C]/20">
            MATCHED
          </span>
        </div>

        {/* Route Line Simulation */}
        <div className="relative flex items-center justify-between py-4 px-2 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F] border-2 border-white ring-4 ring-[#2D6A4F]/10 z-10" />
          <div className="flex-1 border-t-2 border-dashed border-[#2D6A4F] relative mx-1">
            <span className="absolute -top-3 left-[40%] text-sm animate-pulse">🚚</span>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB] border-2 border-white ring-4 ring-[#2563EB]/10 z-10" />
        </div>

        <div className="flex justify-between items-center mt-3 text-[11px]">
          <span className="text-[#9CA3AF]">Est. Distance</span>
          <span className="font-bold text-text-primary">82.4 km</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#9CA3AF]">Payout Escrow</span>
          <span className="font-bold text-[#2D6A4F]">GHS 247.20</span>
        </div>
      </div>
    </div>
  );
};

const EcosystemSimulator: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      title: '1. Harvest & IoT Grading',
      role: 'Farmer Portal',
      actor: 'Kofi Mensah (Keta Farm)',
      badge: 'IoT Traceability',
      description: 'Kofi registers a new batch of 50 bags of shallots. The AgriConnect AI vision scanner grading system analyzes a crop photo and issues an official Quality Grade B.',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconColor: 'bg-emerald-600',
      actionText: 'Lock Order Escrow →',
      details: [
        { label: 'Crop Type', val: 'Red Shallots' },
        { label: 'Batch ID', val: 'BAT-SHA-018' },
        { label: 'Quality Grade', val: 'Grade B (Good)' },
      ]
    },
    {
      title: '2. Escrow Pre-Order Lock',
      role: 'Buyer Portal',
      actor: 'Aya Foods (Commercial Buyer)',
      badge: 'Escrow Secured',
      description: 'Aya Foods secures Kofi\'s shallots with a 20% deposit locked in AgriConnect\'s smart escrow contract. The inventory is instantly reserved, preventing double sales.',
      color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      iconColor: 'bg-indigo-600',
      actionText: 'Find Transport Route →',
      details: [
        { label: 'Escrow Deposit', val: 'GHS 450.00' },
        { label: 'Inventory State', val: 'RESERVED' },
        { label: 'Escrow Escaped', val: 'SECURED' },
      ]
    },
    {
      title: '3. Optimized Route Dispatch',
      role: 'Logistics Portal',
      actor: 'Kwame Logistics (Courier)',
      badge: 'GPS Matched',
      description: 'Kwame receives an automated delivery route request matched to his 3-ton refrigerated truck. Payout rates and fuel fees are auto-calculated for the 180km trip.',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      iconColor: 'bg-amber-600',
      actionText: 'Simulate Final Delivery →',
      details: [
        { label: 'Pickup', val: 'Keta Farm gate' },
        { label: 'Dropoff', val: 'Accra Warehouse' },
        { label: 'Route Cost', val: 'GHS 412.50' },
      ]
    },
    {
      title: '4. Payout & Trace Log',
      role: 'Ecosystem Complete',
      actor: 'Consolidated Trace Registry',
      badge: 'Delivered',
      description: 'Kwame delivers the shallots. Aya Foods inspects and approves. Escrow releases GHS 2,250.00 to Kofi and GHS 412.50 to Kwame. A permanent QR barcode trace event log is created.',
      color: 'bg-teal-50 text-teal-800 border-teal-200',
      iconColor: 'bg-teal-600',
      actionText: 'Restart Simulator ↺',
      details: [
        { label: 'Farmer Payout', val: 'GHS 2,250.00' },
        { label: 'Transporter Payout', val: 'GHS 412.50' },
        { label: 'Barcode Log', val: 'AgriTrace Verified' },
      ]
    }
  ];

  const current = steps[activeStep];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-md grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      {/* Left Selector List (4 steps) */}
      <div className="lg:col-span-5 space-y-3.5">
        {steps.map((s, idx) => {
          const isActive = idx === activeStep;
          return (
            <button
              key={idx}
              onClick={() => setActiveStep(idx)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start gap-3.5 ${
                isActive
                  ? 'border-[#2D6A4F] bg-[#EAF4EE]/40 shadow-sm'
                  : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                isActive ? 'bg-[#2D6A4F]' : 'bg-[#9CA3AF]'
              }`}>
                {idx + 1}
              </div>
              <div className="space-y-0.5">
                <p className={`text-sm font-bold ${isActive ? 'text-[#2D6A4F]' : 'text-text-primary'}`}>
                  {s.title.substring(3)}
                </p>
                <p className="text-[11px] text-text-secondary">
                  {s.role} · {s.badge}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right Details Panel */}
      <div className="lg:col-span-7 p-6 rounded-2xl bg-gray-50 border border-[#E5E7EB] flex flex-col justify-between h-full space-y-6 relative overflow-hidden min-h-[360px]">
        {/* Animated Background Light */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#2D6A4F]/5 rounded-full blur-2xl" />

        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between">
            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${current.color}`}>
              {current.badge}
            </span>
            <span className="text-xs font-semibold text-[#6B7280]">
              Active Role: {current.role}
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-extrabold text-text-primary">{current.title}</h4>
            <p className="text-xs text-[#2D6A4F] font-bold">Actor: {current.actor}</p>
          </div>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            {current.description}
          </p>

          {/* Key-Value Details */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {current.details.map((d, idx) => (
              <div key={idx} className="bg-white p-3 border border-[#E5E7EB] rounded-xl text-center space-y-0.5 shadow-sm">
                <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold truncate">
                  {d.label}
                </p>
                <p className="font-mono text-xs font-extrabold text-text-primary truncate">
                  {d.val}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setActiveStep((prev) => (prev + 1) % 4)}
          className="w-full btn btn-primary flex items-center justify-center gap-1.5 h-11 shadow-sm mt-4 font-bold text-xs"
        >
          {current.actionText}
        </button>
      </div>
    </div>
  );
};

export const Home: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const [filter, setFilter] = useState<'all' | 'crop' | 'buyer' | 'transport'>('all');

  // If user is already authenticated, redirect to their role-specific dashboard
  if (isAuthenticated) {
    if (role === 'FARMER') return <Navigate to="/farmer" replace />;
    if (role === 'BUYER') return <Navigate to="/marketplace" replace />;
    if (role === 'TRANSPORT' || role === 'TRANSPORTER') return <Navigate to="/transporter" replace />;
    if (role === 'ADMIN' || role === 'SUPERADMIN') return <Navigate to="/admin" replace />;
  }

  const mockListings: MockListing[] = [
    {
      id: '1',
      type: 'crop',
      title: 'Fresh Shallots & Red Onions',
      user: 'Kofi Mensah (Farmer)',
      location: 'Keta, Volta Region',
      detail: 'Harvesting next week. Up to 50 bags available for bulk purchase.',
      price: 'GHS 450 per bag',
      extra: '50 bags available',
    },
    {
      id: '2',
      type: 'crop',
      title: 'Organic Habanero Peppers (Kpakpo Shito)',
      user: 'Abena Osei (Farmer)',
      location: 'Mampong, Ashanti Region',
      detail: 'Top quality hot peppers, freshly picked and packed in crates.',
      price: 'GHS 120 per crate',
      extra: '15 crates available',
    },
    {
      id: '3',
      type: 'buyer',
      title: 'Sourcing 500kg Tomatoes Weekly',
      user: 'Aya Food Processing (Buyer)',
      location: 'Accra Industrial Area',
      detail: 'Looking for a reliable farmer partner for consistent plum tomatoes delivery.',
      extra: 'Long-term contract',
    },
    {
      id: '4',
      type: 'transport',
      title: '3-Ton Refrigerated Box Truck',
      user: 'Kwame Logistics (Transporter)',
      location: 'Kumasi Central',
      detail: 'Available for fresh vegetables transport from Ashanti to Greater Accra.',
      price: 'GHS 2.5 per km',
      extra: 'Cold-chain equipped',
    },
    {
      id: '5',
      type: 'crop',
      title: 'Premium Vine Tomatoes',
      user: 'Emmanuel Gyamfi (Farmer)',
      location: 'Ada, Greater Accra',
      detail: 'Greenhouse grown vine tomatoes. High durability for transport.',
      price: 'GHS 180 per box',
      extra: '30 boxes available',
    },
    {
      id: '6',
      type: 'buyer',
      title: 'Urgent: Transport Needed for 100 bags of Okra',
      user: 'Grace AgroTrade (Buyer)',
      location: 'Tamale to Accra Route',
      detail: 'Need immediate dispatch. Okra is packed and ready at the farm gate.',
      extra: 'Immediate payment',
    },
  ];

  const filteredListings = filter === 'all'
    ? mockListings
    : mockListings.filter((l) => l.type === filter);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Public Header */}
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <Link
              to="/"
              className="font-display text-[20px] font-extrabold text-[#2D6A4F] leading-none tracking-tight hover:opacity-90 transition-opacity"
            >
              AgriConnect
            </Link>
            <span className="hidden sm:inline-flex items-center text-[10px] text-[#2D6A4F] font-bold bg-[#EAF4EE] px-2 py-0.5 rounded-full select-none">
              Ghana
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#feed" className="text-sm font-semibold text-[#6B7280] hover:text-[#2D6A4F] transition-colors">
              Marketplace Feed
            </a>
            <Link to="/trace/BAT-TOM-001" className="text-sm font-semibold text-[#6B7280] hover:text-[#2D6A4F] transition-colors">
              Traceability Demo
            </Link>
            <a href="#stats" className="text-sm font-semibold text-[#6B7280] hover:text-[#2D6A4F] transition-colors">
              Impact Stats
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login?mode=login" className="btn btn-secondary h-10 min-h-[40px] px-4 py-2 text-xs font-bold transition-all duration-200">
              Sign In
            </Link>
            <Link to="/login?mode=register" className="btn btn-primary h-10 min-h-[40px] px-4 py-2 text-xs font-bold transition-all duration-200 shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-16">
        {/* Hero Section */}
        <section className="relative rounded-2xl overflow-hidden bg-gradient-to-tr from-[#EAF4EE] via-white to-[#EAF4EE] border border-[#E5E7EB] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-green/5 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-green/5 rounded-full blur-3xl -z-10" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center px-6 py-12 sm:px-12 sm:py-16">
            {/* Left Copy Column */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EAF4EE] text-[#2D6A4F] border border-[#2D6A4F]/20">
                🚜 Empowering Ghanaian Agriculture
              </span>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-text-primary leading-tight">
                Connecting{' '}
                <span className="bg-gradient-to-r from-[#2D6A4F] to-emerald-600 bg-clip-text text-transparent">
                  Farmers, Buyers & Transporters
                </span>
              </h1>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl">
                AgriConnect is Ghana's digital vegetable marketplace. We link rural smallholder farmers
                directly with commercial buyers and transport logistics providers to reduce waste and boost profits.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <a
                  href="#feed"
                  onClick={() => setFilter('all')}
                  className="btn btn-primary flex items-center gap-1.5 shadow-sm font-bold text-xs h-11"
                >
                  Explore Marketplace <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href="#demo"
                  className="btn btn-secondary flex items-center gap-1.5 shadow-sm font-bold text-xs h-11"
                >
                  <Zap className="w-3.5 h-3.5" /> Watch Product Demo
                </a>
              </div>
            </div>

            {/* Right Product Preview Column */}
            <div className="lg:col-span-5 w-full">
              <HeroPreview />
            </div>
          </div>
        </section>

      {/* Stats Counter Row */}
      <section id="stats" className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="stat-card stat-card-green flex items-center justify-between">
          <div>
            <p className="stat-card-label">Registered Farmers</p>
            <h3 className="stat-card-number">1,240+</h3>
          </div>
          <div className="text-3xl">👨‍🌾</div>
        </div>
        <div className="stat-card stat-card-gold flex items-center justify-between">
          <div>
            <p className="stat-card-label">Active Transport Partners</p>
            <h3 className="stat-card-number">380+</h3>
          </div>
          <div className="text-3xl">🚚</div>
        </div>
        <div className="stat-card stat-card-amber flex items-center justify-between">
          <div>
            <p className="stat-card-label">Vegetable Deliveries</p>
            <h3 className="stat-card-number">4,890</h3>
          </div>
          <div className="text-3xl">🍅</div>
        </div>
      </section>

      {/* Three Pillars Section */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl font-extrabold text-text-primary font-display">
            The AgriConnect Ecosystem
          </h2>
          <p className="text-sm text-text-secondary">
            Built specifically to solve Ghanaian agricultural logistics, trust, and quality challenges
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Farmers Card */}
          <div className="premium-card bg-white border border-[#E5E7EB] p-6 space-y-4 hover:border-[#2D6A4F]/30 hover:shadow-md transition-all rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-[#EAF4EE] text-[#2D6A4F] flex items-center justify-center">
              <Leaf className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-primary">For Vegetable Farmers</h3>
            <ul className="space-y-2.5 text-xs text-text-secondary">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**AI Quality Grading**: Scan crops at harvest to receive certifiable quality grades.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**Traceability Tracking**: Record planting logs, fertilizers, and dates permanently.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**Direct Market Sales**: Bypass middle brokers and secure direct commercial buyers.</span>
              </li>
            </ul>
          </div>

          {/* Buyers Card */}
          <div className="premium-card bg-white border border-[#E5E7EB] p-6 space-y-4 hover:border-[#2D6A4F]/30 hover:shadow-md transition-all rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-primary">For Commercial Buyers</h3>
            <ul className="space-y-2.5 text-xs text-text-secondary">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**Verified Batch Grades**: Filter crops by verified AI grade, harvest date, and farm.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**Secure Escrow Checkout**: Secure transactions with pre-order escrow holds.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**Direct Farmer Sourcing**: Buy high-durability vegetables straight from Ada or Volta.</span>
              </li>
            </ul>
          </div>

          {/* Transporters Card */}
          <div className="premium-card bg-white border border-[#E5E7EB] p-6 space-y-4 hover:border-[#2D6A4F]/30 hover:shadow-md transition-all rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-primary">For Logistics Providers</h3>
            <ul className="space-y-2.5 text-xs text-text-secondary">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**Optimized Route Matches**: Accept pre-grouped route orders to maximize cargo capacity.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**Guaranteed Payouts**: Delivery dispatches are locked via buyer escrow payouts.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <span>**Map Navigation**: Live pickup/dropoff timeline maps and phone SMS dispatch codes.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Interactive Simulator Section */}
      <section id="demo" className="space-y-8 pt-4">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl font-extrabold text-text-primary font-display">
            Interactive Product Simulator
          </h2>
          <p className="text-sm text-text-secondary">
            Simulate a batch of crop going through our digital escrow and logistics pipeline
          </p>
        </div>
        <EcosystemSimulator />
      </section>

      {/* Marketplace Listings Section */}
      <section id="feed" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-[18px] sm:text-[20px] font-bold text-text-primary">Live Marketplace Feed</h2>
            <p className="text-sm text-text-secondary">Real-time offers and logistics request updates across Ghana</p>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Listings' },
              { id: 'crop', label: 'Crops (Farmers)' },
              { id: 'buyer', label: 'Buying Demands' },
              { id: 'transport', label: 'Logistics Options' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all-custom cursor-pointer ${
                  filter === tab.id
                    ? 'bg-[#EAF4EE] text-[#2D6A4F] border-[#2D6A4F]/30'
                    : 'bg-white text-text-secondary border-border-default hover:bg-[#F9FAFB] hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredListings.map((listing) => (
            <div
              key={listing.id}
              className="premium-card premium-card-clickable premium-card-hover flex flex-col justify-between space-y-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`badge ${
                      listing.type === 'crop'
                        ? 'badge-success'
                        : listing.type === 'buyer'
                        ? 'badge-info'
                        : 'badge-neutral'
                    }`}
                  >
                    {listing.type === 'crop' ? '🍅 Crop' : listing.type === 'buyer' ? '💼 Demand' : '🚚 Logistics'}
                  </span>
                  <span className="text-xs text-text-secondary flex items-center gap-1">
                    📍 {listing.location}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-text-primary leading-snug">{listing.title}</h4>
                <p className="text-xs text-primary-green font-medium">{listing.user}</p>
                <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">{listing.detail}</p>
              </div>

              <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
                <div>
                  {listing.price && (
                    <span className="text-sm font-bold text-accent-gold font-mono">
                      {listing.price}
                    </span>
                  )}
                  {listing.extra && (
                    <span className="block text-[11px] text-text-muted mt-0.5 font-mono">
                      {listing.extra}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    toast('Create a free account to contact this seller directly.', { icon: '🔒' });
                    window.location.href = '/login?mode=register';
                  }}
                  className="btn btn-secondary h-[36px] min-h-[36px] px-3 py-1 rounded-lg text-xs"
                >
                  Contact
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Success Stories / Testimonials */}
      <section className="space-y-8 pt-4">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl font-extrabold text-text-primary font-display">
            Success Stories
          </h2>
          <p className="text-sm text-text-secondary">
            Hear from actual farmers, buyers, and transporters using AgriConnect in Ghana
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Kofi Mensah (Farmer) */}
          <div className="premium-card bg-[#EAF4EE]/30 border border-[#2D6A4F]/20 p-5 space-y-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2D6A4F] text-white font-bold text-xs flex items-center justify-center">
                KM
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">Kofi Mensah</p>
                <p className="text-[10px] text-text-secondary">Farmer · Volta Region</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary italic leading-relaxed">
              "AgriConnect completely transformed my business. Previously, I sold to brokers at a loss. Now, my crops are graded A/B and I lock contracts with buyers in Accra before harvest!"
            </p>
            <div className="flex items-center gap-1 text-[#2D6A4F] text-xs font-bold">
              <TrendingUp className="w-4 h-4" />
              <span>+35% profit margin increase</span>
            </div>
          </div>

          {/* Grace Agro (Buyer) */}
          <div className="premium-card bg-white border border-[#E5E7EB] p-5 space-y-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                GA
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">Grace AgroTrade</p>
                <p className="text-[10px] text-text-secondary">Vegetable Wholesaler · Accra</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary italic leading-relaxed">
              "Finding high-quality vine tomatoes consistently was always a nightmare. With AgriConnect's escrow pre-orders and AI grading logs, I always know exactly what I am purchasing."
            </p>
            <div className="flex items-center gap-1 text-indigo-700 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>100% secure escrow checkouts</span>
            </div>
          </div>

          {/* Kwame Logistics (Transporter) */}
          <div className="premium-card bg-white border border-[#E5E7EB] p-5 space-y-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                KL
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">Kwame Logistics</p>
                <p className="text-[10px] text-text-secondary">Truck Courier · Kumasi</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary italic leading-relaxed">
              "The group route dispatches save me fuel costs, and I don't have to worry about unpaid shipments anymore. Escrow payments guarantee my transport fare is released instantly."
            </p>
            <div className="flex items-center gap-1 text-amber-700 text-xs font-bold">
              <MapPin className="w-4 h-4" />
              <span>Escrow secured courier dispatches</span>
            </div>
          </div>
        </div>
      </section>
      </main>

      {/* Premium Footer */}
      <footer className="bg-white border-t border-[#E5E7EB] py-12 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-[#F3F4F6]">
          {/* Logo & Slogan Column */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌱</span>
              <span className="font-display text-[20px] font-extrabold text-[#2D6A4F] tracking-tight">
                AgriConnect
              </span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
              AgriConnect is Ghana's leading digital agricultural vegetable exchange connecting rural farmers with buyers and courier logistics providers.
            </p>
          </div>

          {/* Platform Links */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-xs text-text-secondary font-semibold">
              <li><a href="#feed" className="hover:text-[#2D6A4F] transition-colors">Marketplace Feed</a></li>
              <li><Link to="/trace/BAT-TOM-001" className="hover:text-[#2D6A4F] transition-colors">Traceability Demo</Link></li>
              <li><a href="#demo" className="hover:text-[#2D6A4F] transition-colors">Ecosystem Simulator</a></li>
            </ul>
          </div>

          {/* Support Links */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Support</h4>
            <ul className="space-y-2 text-xs text-text-secondary font-semibold">
              <li><Link to="/login" className="hover:text-[#2D6A4F] transition-colors">Help Center</Link></li>
              <li><span className="text-text-muted select-none">USSD System: *842#</span></li>
              <li><span className="text-text-muted select-none">SMS Helpdesk</span></li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div className="md:col-span-4 space-y-3.5">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Stay Updated</h4>
            <p className="text-xs text-text-secondary">Receive bi-weekly harvest forecasts, market pricing reports, and platform dispatches.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="email"
                  placeholder="Enter your email..."
                  className="form-input w-full pl-9 py-2 text-xs bg-white h-10"
                />
              </div>
              <button
                type="button"
                onClick={() => toast.success('Subscribed! Thank you.')}
                className="btn btn-primary text-xs font-bold px-4 h-10 shrink-0"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-text-muted gap-4 font-semibold">
          <p>© {new Date().getFullYear()} AgriConnect Ghana. Secure Escrow & Blockchain Traceability Registry.</p>
          <div className="flex gap-4">
            <span className="hover:text-text-secondary cursor-pointer">Terms of Service</span>
            <span className="hover:text-text-secondary cursor-pointer">Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default Home;
