import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { HealthStatus } from './pages/HealthStatus';
import { LoginPage as Login } from './pages/auth/LoginPage';
import { ProfileSetupPage } from './pages/auth/ProfileSetupPage';
import { Trace } from './pages/Trace';
import { FarmerDashboardPage } from './pages/farmer/FarmerDashboardPage';
import { NewListingPage } from './pages/farmer/NewListingPage';
import { ListingDetailPage } from './pages/farmer/ListingDetailPage';

import { Toaster } from 'react-hot-toast';

// React Query client definition
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds stale time
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
          {/* Apply bg-white to the root div wrapping the router */}
          <div className="bg-white text-text-primary min-h-screen">
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
                success: {
                  iconTheme: {
                    primary: '#2D6A4F',
                    secondary: '#FFFFFF',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#DC2626',
                    secondary: '#FFFFFF',
                  },
                },
              }}
            />
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/trace/:batchCode" element={<Trace />} />

              {/* Protected Routes (wrapped in AuthGuard) */}
              <Route
                path="/*"
                element={
                  <AuthGuard>
                    <Routes>
                      {/* Protected Page without Layout shell */}
                      <Route path="/setup-profile" element={<ProfileSetupPage />} />

                      {/* Protected Pages with Layout shell */}
                      <Route
                        path="/*"
                        element={
                          <Layout>
                            <Routes>
                              <Route path="/" element={<Home />} />
                              <Route path="/health" element={<HealthStatus />} />
                              <Route path="/farmer" element={<FarmerDashboardPage />} />
                              <Route path="/farmer/listings/new" element={<NewListingPage />} />
                              <Route path="/farmer/listings/:id" element={<ListingDetailPage />} />
                              <Route path="/farmer/listings/edit/:id" element={<NewListingPage isEdit={true} />} />
                            </Routes>
                          </Layout>
                        }
                      />
                    </Routes>
                  </AuthGuard>
                }
              />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
