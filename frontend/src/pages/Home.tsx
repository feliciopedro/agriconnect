import { useState } from 'react';
import { Link } from 'react-router-dom';

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

export const Home: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'crop' | 'buyer' | 'transport'>('all');

  const mockListings: MockListing[] = [
    {
      id: '1',
      type: 'crop',
      title: 'Fresh Shallots & Red Onions',
      user: 'Kofi Mensah (Farmer)',
      location: 'Keta, Volta Region',
      detail: 'Harvesting next week. Up to 50 bags available for bulk purchase.',
      price: 'GHS 450 per bag',
      extra: '50 bags available'
    },
    {
      id: '2',
      type: 'crop',
      title: 'Organic Habanero Peppers (Kpakpo Shito)',
      user: 'Abena Osei (Farmer)',
      location: 'Mampong, Ashanti Region',
      detail: 'Top quality hot peppers, freshly picked and packed in crates.',
      price: 'GHS 120 per crate',
      extra: '15 crates available'
    },
    {
      id: '3',
      type: 'buyer',
      title: 'Sourcing 500kg Tomatoes Weekly',
      user: 'Aya Food Processing (Buyer)',
      location: 'Accra Industrial Area',
      detail: 'Looking for a reliable farmer partner for consistent plum tomatoes delivery.',
      extra: 'Long-term contract'
    },
    {
      id: '4',
      type: 'transport',
      title: '3-Ton Refrigerated Box Truck',
      user: 'Kwame Logistics (Transporter)',
      location: 'Kumasi Central',
      detail: 'Available for fresh vegetables transport from Ashanti to Greater Accra.',
      price: 'GHS 2.5 per km',
      extra: 'Cold-chain equipped'
    },
    {
      id: '5',
      type: 'crop',
      title: 'Premium Vine Tomatoes',
      user: 'Emmanuel Gyamfi (Farmer)',
      location: 'Ada, Greater Accra',
      detail: 'Greenhouse grown vine tomatoes. High durability for transport.',
      price: 'GHS 180 per box',
      extra: '30 boxes available'
    },
    {
      id: '6',
      type: 'buyer',
      title: 'Urgent: Transport Needed for 100 bags of Okra',
      user: 'Grace AgroTrade (Buyer)',
      location: 'Tamale to Accra Route',
      detail: 'Need immediate dispatch. Okra is packed and ready at the farm gate.',
      extra: 'Immediate payment'
    }
  ];

  const filteredListings = filter === 'all' 
    ? mockListings 
    : mockListings.filter(l => l.type === filter);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/70 to-slate-950/90 mix-blend-multiply z-0" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -z-10" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 sm:px-12 sm:py-24 text-center space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            🚜 Empowering Ghanaian Agriculture
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
            Connecting{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Farmers, Buyers & Transporters
            </span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            AgriConnect is Ghana's digital vegetable marketplace. We link rural smallholder farmers 
            directly with commercial buyers and transport logistics providers to reduce waste and boost profits.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button 
              onClick={() => setFilter('all')}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition-all-custom cursor-pointer"
            >
              Explore Marketplace
            </button>
            <Link 
              to="/health"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all-custom"
            >
              Check Backend Connectivity
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Counter Row */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Farmers</p>
            <h3 className="text-3xl font-extrabold mt-1 text-slate-100">1,240+</h3>
          </div>
          <div className="text-3xl">👨‍🌾</div>
        </div>
        <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-teal-500">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Transport Partners</p>
            <h3 className="text-3xl font-extrabold mt-1 text-slate-100">380+</h3>
          </div>
          <div className="text-3xl">🚚</div>
        </div>
        <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vegetable Deliveries</p>
            <h3 className="text-3xl font-extrabold mt-1 text-slate-100">4,890 Tons</h3>
          </div>
          <div className="text-3xl">🍅</div>
        </div>
      </section>

      {/* Marketplace Listings Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Live Marketplace Feed</h2>
            <p className="text-sm text-slate-400">Real-time offers and logistics request updates across Ghana</p>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Listings' },
              { id: 'crop', label: 'Crops (Farmers)' },
              { id: 'buyer', label: 'Buying Demands' },
              { id: 'transport', label: 'Logistics Options' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all-custom cursor-pointer ${
                  filter === tab.id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map(listing => (
            <div 
              key={listing.id}
              className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between space-y-4 transition-all-custom shadow-md"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    listing.type === 'crop' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : listing.type === 'buyer'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {listing.type === 'crop' ? '🍅 Crop Listing' : listing.type === 'buyer' ? '💼 Sourcing Demand' : '🚚 Logistics'}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    📍 {listing.location}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-100 leading-snug">{listing.title}</h4>
                <p className="text-xs text-emerald-500/80 font-medium">{listing.user}</p>
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">{listing.detail}</p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  {listing.price && (
                    <span className="text-sm font-semibold text-slate-300">
                      {listing.price}
                    </span>
                  )}
                  {listing.extra && (
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      {listing.extra}
                    </span>
                  )}
                </div>
                <button className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 hover:text-emerald-400 text-slate-300 border border-slate-700 transition-all-custom cursor-pointer">
                  Contact
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
