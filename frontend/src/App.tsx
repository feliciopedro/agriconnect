import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { PageLoader } from './components/shell/PageLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { HealthStatus } from './pages/HealthStatus';
import { LoginPage as Login } from './pages/auth/LoginPage';
import { ProfileSetupPage } from './pages/auth/ProfileSetupPage';
import { ProfilePage } from './pages/auth/ProfilePage';
import { TracePublicPage } from './pages/TracePublicPage';
import { FarmerDashboardPage } from './pages/farmer/FarmerDashboardPage';
import { NewListingPage } from './pages/farmer/NewListingPage';
import { ListingDetailPage } from './pages/farmer/ListingDetailPage';
import { MarketplacePage } from './pages/buyer/MarketplacePage';
import { ListingDetailBuyerPage } from './pages/buyer/ListingDetailBuyerPage';
import { OrdersPage } from './pages/buyer/OrdersPage';
import { OrderDetailPage } from './pages/buyer/OrderDetailPage';
import { TransportDashboardPage } from './pages/transport/TransportDashboardPage';
import { DeliveryDetailPage } from './pages/transport/DeliveryDetailPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { MessagesPage } from './pages/MessagesPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminTracePage } from './pages/admin/AdminTracePage';
import { UssdSimulatorPage } from './pages/admin/UssdSimulatorPage';
import { UssdMonitorPage } from './pages/admin/UssdMonitorPage';
import { NotFoundPage } from './pages/NotFoundPage';

import { Toaster } from 'react-hot-toast';

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="bg-white text-text-primary">
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#FFFFFF',
                  color: '#111827',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                  borderRadius: '10px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '14px',
                },
                success: { iconTheme: { primary: '#2D6A4F', secondary: '#FFFFFF' } },
                error:   { iconTheme: { primary: '#DC2626', secondary: '#FFFFFF' } },
              }}
            />

            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/trace/:batchCode" element={<TracePublicPage />} />

                {/* Protected routes */}
                <Route
                  path="/*"
                  element={
                    <AuthGuard>
                      <Routes>
                        {/* Outside Layout shell */}
                        <Route path="/setup-profile" element={<ProfileSetupPage />} />

                        {/* Inside Layout (AppShell) */}
                        <Route
                          path="/*"
                          element={
                            <Layout>
                              <Routes>
                                <Route path="/profile"                       element={<ProfilePage />} />
                                <Route path="/health"                        element={<HealthStatus />} />

                                {/* Farmer */}
                                <Route path="/farmer"                        element={<FarmerDashboardPage />} />
                                <Route path="/farmer/listings/new"           element={<NewListingPage />} />
                                <Route path="/farmer/listings/:id"           element={<ListingDetailPage />} />
                                <Route path="/farmer/listings/edit/:id"      element={<NewListingPage isEdit={true} />} />

                                {/* Buyer */}
                                <Route path="/marketplace"                   element={<MarketplacePage />} />
                                <Route path="/marketplace/listings/:id"      element={<ListingDetailBuyerPage />} />
                                <Route path="/orders"                        element={<OrdersPage />} />
                                <Route path="/orders/:id"                    element={<OrderDetailPage />} />

                                {/* Transport */}
                                <Route path="/transporter"                   element={<TransportDashboardPage />} />
                                <Route path="/transporter/deliveries/:id"    element={<DeliveryDetailPage />} />

                                {/* Shared */}
                                <Route path="/notifications"                 element={<NotificationsPage />} />
                                <Route path="/messages"                      element={<MessagesPage />} />

                                {/* Admin */}
                                <Route path="/admin"                         element={<AdminDashboardPage />} />
                                <Route path="/admin/users"                   element={<AdminUsersPage />} />
                                <Route path="/admin/trace"                   element={<AdminTracePage />} />
                                <Route path="/admin/ussd-simulator"          element={<UssdSimulatorPage />} />
                                <Route path="/admin/ussd-monitor"            element={<UssdMonitorPage />} />

                                {/* 404 catch-all */}
                                <Route path="*"                              element={<NotFoundPage />} />
                              </Routes>
                            </Layout>
                          }
                        />
                      </Routes>
                    </AuthGuard>
                  }
                />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
