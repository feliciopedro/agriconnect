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
    <div className="space-y-6 sm:space-y-8 bg-white">
      {/* Hero Section */}
      <section className="relative rounded-[10px] overflow-hidden bg-gradient-to-tr from-primary-light via-white to-primary-light border border-border-default shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-green/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-green/5 rounded-full blur-3xl -z-10" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 sm:px-12 sm:py-20 text-center space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-light text-primary-green border border-primary-green/20">
            🚜 Empowering Ghanaian Agriculture
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-text-primary">
            Connecting{' '}
            <span className="bg-gradient-to-r from-primary-green to-emerald-600 bg-clip-text text-transparent">
              Farmers, Buyers & Transporters
            </span>
          </h1>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            AgriConnect is Ghana's digital vegetable marketplace. We link rural smallholder farmers
            directly with commercial buyers and transport logistics providers to reduce waste and boost profits.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <button
              onClick={() => setFilter('all')}
              className="btn btn-primary shadow-sm"
            >
              Explore Marketplace
            </button>
            <Link
              to="/health"
              className="btn btn-secondary shadow-sm"
            >
              Check Backend Connectivity
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Counter Row */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
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

      {/* Marketplace Listings Section */}
      <section className="space-y-6">
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
                    ? 'bg-primary-light text-primary-green border-primary-green/30'
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

              <div className="pt-4 border-t border-border-default flex items-center justify-between">
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
                <button className="btn btn-secondary h-[36px] min-h-[36px] px-3 py-1 rounded-lg text-xs">
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
export default Home;
