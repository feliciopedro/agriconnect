import { useEffect, useState } from 'react';
import api from '../api/axiosInstance';
import type { HealthCheckResponse } from '../types';

export const HealthStatus: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<HealthCheckResponse>('/health');
      setHealthData(response.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not connect to the backend server. Make sure it is running on port 5000.');
    } finally {
      const minWait = new Promise((resolve) => setTimeout(resolve, 500));
      await minWait;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 bg-white">
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">API Server Connectivity & Status</h1>
        <p className="text-text-secondary mt-2">Monitor connection health and service integrations of the AgriConnect monorepo backend.</p>
      </div>

      {loading ? (
        <div className="premium-card rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary-green/20 border-t-primary-green rounded-full animate-spin" />
          <p className="text-text-secondary text-sm">Querying backend API health...</p>
        </div>
      ) : error ? (
        <div className="premium-card rounded-2xl p-8 border-l-4 border-l-error-red bg-error-red-bg space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="text-lg font-bold text-error-red">Backend Connection Error</h3>
              <p className="text-xs text-text-secondary">GET /api/health is unreachable</p>
            </div>
          </div>
          <p className="text-sm text-text-primary bg-white p-4 rounded-xl border border-border-default font-mono text-xs shadow-sm">
            {error}
          </p>
          <div className="pt-2">
            <button
              onClick={fetchHealth}
              className="btn btn-secondary shadow-sm"
            >
              Retry Connection
            </button>
          </div>
        </div>
      ) : healthData ? (
        <div className="space-y-6">
          {/* Main Status Header */}
          <div className="premium-card rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full animate-pulse ${
                healthData.status?.toUpperCase() === 'OK' ? 'bg-primary-green' : 'bg-warning-amber'
              }`} />
              <div>
                <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  System Status: 
                  <span className={`badge ${healthData.status?.toUpperCase() === 'OK' ? 'badge-success' : 'badge-warning'}`}>
                    {healthData.status}
                  </span>
                </h3>
                <p className="text-xs text-text-muted">Last updated: {new Date(healthData.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
            <button
              onClick={fetchHealth}
              className="btn btn-primary shadow-sm"
            >
              Refresh Status
            </button>
          </div>

          {/* Detailed stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="premium-card rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider">API Instance Details</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between border-b border-border-default pb-2">
                  <span className="text-text-secondary">Status</span>
                  <span className="badge badge-success font-mono">Online</span>
                </div>
                <div className="flex justify-between border-b border-border-default pb-2">
                  <span className="text-text-secondary">Uptime</span>
                  <span className="text-text-primary font-mono">{(healthData.uptime / 60).toFixed(2)} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Port</span>
                  <span className="text-text-primary font-mono">5000</span>
                </div>
              </div>
            </div>

            <div className="premium-card rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Database Status (PostgreSQL)</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between border-b border-border-default pb-2">
                  <span className="text-text-secondary">Prisma Status</span>
                  <span className={`badge ${
                    healthData.services.database.status === 'CONNECTED' ? 'badge-success' : 'badge-error'
                  }`}>
                    {healthData.services.database.status}
                  </span>
                </div>
                {healthData.services.database.error && (
                  <div className="text-xs text-warning-amber bg-warning-amber-bg p-3 rounded-lg border border-warning-amber/20">
                    <span className="font-semibold block mb-1">Reason:</span>
                    {healthData.services.database.error}
                  </div>
                )}
                {!healthData.services.database.error && (
                  <div className="text-xs text-text-muted">
                    Prisma Client successfully queried PostgreSQL database.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full Raw Payload */}
          <div className="premium-card rounded-2xl p-6 space-y-3">
            <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Raw API Response Payload</h4>
            <pre className="text-[11px] font-mono text-primary-green bg-primary-light/50 p-4 rounded-xl border border-border-default overflow-x-auto">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
};
export default HealthStatus;
