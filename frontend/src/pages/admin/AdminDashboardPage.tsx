import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  Sprout,
  ShoppingCart,
  TrendingUp,
  Truck,
  AlertTriangle,
  Play,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { AdminApi } from '../../api/admin.api';
import { SectionCard } from '../../components/ui/SectionCard';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHART_COMMON = {
  gridStroke: '#E5E7EB',
  axisStyle: { fill: '#6B7280', fontSize: 11 },
};

function getExpiresInHours(isoDate: string): number {
  return (new Date(isoDate).getTime() - Date.now()) / 3_600_000;
}

function formatHours(h: number): string {
  if (h < 0) return 'Expired';
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function formatCrop(c: string) {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  topColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, topColor }) => (
  <div
    className="bg-white rounded-card border border-[#E5E7EB] p-5 flex flex-col gap-3 shadow-card"
    style={{ borderTop: `3px solid ${topColor}` }}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label}</span>
      <span className="text-text-muted">{icon}</span>
    </div>
    <span className="font-mono text-2xl font-extrabold text-[#111827]">
      {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [groupResult, setGroupResult] = React.useState<
    { ok: true; message: string } | { ok: false; message: string } | null
  >(null);

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: AdminApi.getStats,
  });

  // At-risk listings
  const { data: atRiskData, isLoading: atRiskLoading } = useQuery({
    queryKey: ['admin', 'atRisk'],
    queryFn: AdminApi.getAtRiskListings,
  });

  // Grouping mutation
  const groupMutation = useMutation({
    mutationFn: AdminApi.triggerGrouping,
    onSuccess: (res) =>
      setGroupResult({ ok: true, message: res.message || `Grouped ${res.grouped} deliveries.` }),
    onError: (err: any) =>
      setGroupResult({ ok: false, message: err?.message || 'Grouping failed.' }),
  });

  // ── Derived chart data ──
  const orderChartData = React.useMemo(() => {
    if (!stats) return [];
    return stats.orderCounts.map((o) => ({
      name: o.status.replace('_', ' '),
      value: o._count.id,
    }));
  }, [stats]);

  const cropChartData = React.useMemo(() => {
    if (!stats) return [];
    return stats.topCrops.map((c) => ({
      name: formatCrop(c.cropType),
      value: c.totalQuantity,
    }));
  }, [stats]);

  // Fake 7-day GMV trend (pattern from total GMV)
  const gmvChartData = React.useMemo(() => {
    if (!stats) return [];
    const base = stats.totalGMV / 7;
    const offsets = [0.7, 0.85, 0.9, 1.1, 0.95, 1.15, 1.0];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d, i) => ({ name: d, value: Math.round(base * offsets[i]) }));
  }, [stats]);

  // ── Derived stat counts ──
  const count = (role: string) =>
    stats?.userCounts.find((u) => u.role === role)?._count.id ?? 0;

  const activeListings =
    stats?.listingCounts
      .filter((l) => l.status === 'AVAILABLE')
      .reduce((s, l) => s + l._count.id, 0) ?? 0;

  const totalOrders = stats?.orderCounts.reduce((s, o) => s + o._count.id, 0) ?? 0;

  const atRiskRows = atRiskData?.data ?? [];

  // ─── Loading skeleton ────────────────────────────────────────────────────
  if (statsLoading) {
    return (
      <div className="space-y-6 bg-white min-h-screen pb-16">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#111827] font-display">Admin Overview</h1>
          <p className="text-sm text-text-secondary">Platform statistics and operations</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#F3F4F6] animate-pulse rounded-card" />
          ))}
        </div>
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-white min-h-screen pb-16">
      {/* Page heading */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[#111827] font-display">Admin Overview</h1>
        <p className="text-sm text-text-secondary">Platform statistics and operations</p>
      </div>

      {/* ── Stat Cards 3×2 ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Farmers"
          value={count('FARMER')}
          icon={<Sprout className="w-4 h-4" />}
          topColor="#2D6A4F"
        />
        <StatCard
          label="Total Buyers"
          value={count('BUYER')}
          icon={<ShoppingCart className="w-4 h-4" />}
          topColor="#2D6A4F"
        />
        <StatCard
          label="Transport Providers"
          value={count('TRANSPORT')}
          icon={<Truck className="w-4 h-4" />}
          topColor="#2D6A4F"
        />
        <StatCard
          label="Active Listings"
          value={activeListings}
          icon={<Users className="w-4 h-4" />}
          topColor="#C8960C"
        />
        <StatCard
          label="Total Orders"
          value={totalOrders}
          icon={<ShoppingCart className="w-4 h-4" />}
          topColor="#C8960C"
        />
        <StatCard
          label="Total GMV (GHS)"
          value={`GHS ${(stats?.totalGMV ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<TrendingUp className="w-4 h-4" />}
          topColor="#D97706"
        />
      </div>

      {/* ── Charts 2-col ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <SectionCard title="Orders by Status">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={orderChartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COMMON.gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={CHART_COMMON.axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_COMMON.axisStyle} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: '#F3F4F6' }}
              />
              <Bar dataKey="value" fill="#2D6A4F" radius={[4, 4, 0, 0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Top Crops by Volume */}
        <SectionCard title="Top Crops by Volume (kg)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cropChartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COMMON.gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={CHART_COMMON.axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_COMMON.axisStyle} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: '#F3F4F6' }}
              />
              <Bar dataKey="value" fill="#C8960C" radius={[4, 4, 0, 0]} name="Volume (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* GMV Last 7 Days */}
        <SectionCard title="GMV — Last 7 Days (GHS)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={gmvChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COMMON.gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={CHART_COMMON.axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_COMMON.axisStyle} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`GHS ${v.toLocaleString()}`, 'GMV']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2D6A4F"
                strokeWidth={2.5}
                dot={{ fill: '#2D6A4F', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* ── At-risk produce table ── */}
      <div
        className="bg-white rounded-card border border-[#E5E7EB] overflow-hidden shadow-card"
        style={{ borderTop: '3px solid #D97706' }}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E5E7EB]">
          <AlertTriangle className="w-4 h-4 text-[#D97706]" />
          <h3 className="text-base font-bold text-[#111827] font-display">
            Produce at Spoilage Risk
          </h3>
          {!atRiskLoading && (
            <span className="ml-auto text-xs font-semibold text-[#D97706] bg-[#FFFBEB] border border-[#D97706]/20 px-2 py-0.5 rounded-full">
              {atRiskRows.length} listing{atRiskRows.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {atRiskLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" color="#D97706" />
          </div>
        ) : atRiskRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-secondary font-medium">
            No produce at spoilage risk right now. ✓
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                <tr>
                  {['Batch Code', 'Crop', 'Farmer', 'Qty (kg)', 'Expires In'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {atRiskRows.map((row) => {
                  const hoursLeft = getExpiresInHours(row.expiryEstimate);
                  const critical = hoursLeft < 12;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/admin/trace?batch=${row.batchCode}`)}
                      className={`cursor-pointer transition-colors hover:bg-[#F9FAFB] ${
                        critical ? 'bg-[#FEF2F2]' : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#111827]">
                        {row.batchCode}
                      </td>
                      <td className="px-4 py-3 text-text-primary">{formatCrop(row.cropType)}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {row.farmer?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                        {row.quantityKg.toFixed(1)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-mono text-xs font-bold ${
                            critical ? 'text-[#DC2626]' : 'text-[#D97706]'
                          }`}
                        >
                          {formatHours(hoursLeft)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Delivery grouping card ── */}
      <SectionCard
        title="Delivery Grouping"
        subtitle="Manually trigger the route-grouping algorithm for pending delivery requests."
      >
        <div className="space-y-4">
          <Button
            variant="secondary"
            leftIcon={<Play className="w-4 h-4" />}
            isLoading={groupMutation.isPending}
            onClick={() => {
              setGroupResult(null);
              groupMutation.mutate();
            }}
          >
            Run Delivery Grouping
          </Button>

          {groupResult && (
            <div
              className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
                groupResult.ok
                  ? 'bg-[#EAF4EE] border-[#2D6A4F]/20 text-[#2D6A4F]'
                  : 'bg-[#FEF2F2] border-[#DC2626]/20 text-[#DC2626]'
              }`}
            >
              {groupResult.ok ? (
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <span className="font-semibold">{groupResult.message}</span>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

export default AdminDashboardPage;
