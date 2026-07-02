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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">API Server Connectivity & Status</h1>
        <p className="text-slate-400 mt-2">Monitor connection health and service integrations of the AgriConnect monorepo backend.</p>
      </div>

      {loading ? (
        <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Querying http://localhost:5000/api/health...</p>
        </div>
      ) : error ? (
        <div className="glass-panel rounded-2xl p-8 border-l-4 border-l-red-500 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="text-lg font-bold text-red-400">Backend Connection Error</h3>
              <p className="text-xs text-slate-500">GET http://localhost:5000/api/health is unreachable</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 bg-slate-900/50 p-4 rounded-xl border border-slate-800 font-mono text-xs">
            {error}
          </p>
          <div className="pt-2">
            <button
              onClick={fetchHealth}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all-custom cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        </div>
      ) : healthData ? (
        <div className="space-y-6">
          {/* Main Status Header */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full animate-pulse ${
                healthData.status === 'OK' ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
              <div>
                <h3 className="text-xl font-bold">
                  System Status: <span className={healthData.status === 'OK' ? 'text-emerald-400' : 'text-amber-400'}>{healthData.status}</span>
                </h3>
                <p className="text-xs text-slate-500">Last updated: {new Date(healthData.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
            <button
              onClick={fetchHealth}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-lg transition-all-custom cursor-pointer"
            >
              Refresh Status
            </button>
          </div>

          {/* Detailed stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">API Instance Details</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-500">Status</span>
                  <span className="text-emerald-400 font-semibold">Online</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-500">Uptime</span>
                  <span className="text-slate-300 font-mono">{(healthData.uptime / 60).toFixed(2)} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Port</span>
                  <span className="text-slate-300 font-mono">5000</span>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Database Status (PostgreSQL)</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-500">Prisma Status</span>
                  <span className={`font-semibold ${
                    healthData.services.database.status === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {healthData.services.database.status}
                  </span>
                </div>
                {healthData.services.database.error && (
                  <div className="text-xs text-amber-500 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                    <span className="font-semibold block mb-1">Reason:</span>
                    {healthData.services.database.error}
                  </div>
                )}
                {!healthData.services.database.error && (
                  <div className="text-xs text-slate-400">
                    Prisma Client successfully queried PostgreSQL database.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full Raw Payload */}
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Raw API Response Payload</h4>
            <pre className="text-[11px] font-mono text-emerald-400 bg-slate-900/60 p-4 rounded-xl border border-slate-800 overflow-x-auto">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
};
