import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  AlertTriangle,
  Phone,
  User,
  CheckCircle,
} from 'lucide-react';
import { AdminApi } from '../../api/admin.api';
import type { AdminTraceResponse } from '../../api/admin.api';
import { SectionCard } from '../../components/ui/SectionCard';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCrop(c: string) {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const EVENT_SEQUENCE = [
  'HARVESTED', 'LISTED', 'QUALITY_CHECKED',
  'RESERVED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED',
];

function eventLabel(type: string) {
  const map: Record<string, string> = {
    HARVESTED: 'Harvested',
    LISTED: 'Listed on AgriConnect',
    QUALITY_CHECKED: 'Quality Assessed',
    RESERVED: 'Order Placed',
    PICKED_UP: 'Picked Up for Delivery',
    IN_TRANSIT: 'In Transit',
    DELIVERED: 'Delivered ✓',
  };
  return map[type.toUpperCase()] ?? type;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

const TraceTimeline: React.FC<{ trace: AdminTraceResponse }> = ({ trace }) => {
  const latestType = trace.timeline[trace.timeline.length - 1]?.eventType ?? '';
  const latestIdx = EVENT_SEQUENCE.indexOf(latestType);
  const futureEvents = latestIdx !== -1 ? EVENT_SEQUENCE.slice(latestIdx + 1) : [];

  return (
    <div className="relative border-l-2 border-[#E5E7EB] ml-3 pl-8 space-y-7">
      {trace.timeline.map((ev, i) => {
        const isCurrent = i === trace.timeline.length - 1;
        return (
          <div key={i} className="relative">
            <span className="absolute -left-[41px] top-1.5 flex items-center justify-center bg-white rounded-full">
              {isCurrent ? (
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D6A4F]/30" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2D6A4F]" />
                </span>
              ) : (
                <span className="h-3 w-3 rounded-full bg-[#2D6A4F]" />
              )}
            </span>
            <div className="space-y-0.5">
              <p className={`text-sm font-bold ${isCurrent ? 'text-[#2D6A4F]' : 'text-[#111827]'}`}>
                {eventLabel(ev.eventType)}
              </p>
              <p className="text-[11px] text-[#9CA3AF] font-medium">{formatTs(ev.timestamp)}</p>
              {ev.notes && (
                <p className="text-xs text-text-secondary pt-0.5 leading-relaxed">{ev.notes}</p>
              )}
            </div>
          </div>
        );
      })}

      {futureEvents.map((type, i) => (
        <div key={i} className="relative opacity-50">
          <span className="absolute -left-[40px] top-1.5 flex h-3.5 w-3.5 items-center justify-center bg-white rounded-full">
            <span className="h-3 w-3 rounded-full border-2 border-[#E5E7EB] bg-white" />
          </span>
          <p className="text-sm font-semibold text-[#9CA3AF]">{eventLabel(type)}</p>
          <p className="text-[10px] text-[#D1D5DB] font-medium">Pending</p>
        </div>
      ))}
    </div>
  );
};

// ─── Event type options ───────────────────────────────────────────────────────

const EVENT_TYPES = EVENT_SEQUENCE;

// ─── Page ─────────────────────────────────────────────────────────────────────

export const AdminTracePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [inputCode, setInputCode] = React.useState(
    () => searchParams.get('batch') ?? ''
  );
  const [activeCode, setActiveCode] = React.useState(
    () => searchParams.get('batch') ?? ''
  );
  const [traceData, setTraceData] = React.useState<AdminTraceResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Manual event form
  const [eventType, setEventType] = React.useState(EVENT_TYPES[0]);
  const [eventNotes, setEventNotes] = React.useState('');

  // Auto-lookup if ?batch= present on mount
  React.useEffect(() => {
    if (activeCode) performLookup(activeCode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const performLookup = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setTraceData(null);
    try {
      const res = await AdminApi.getAdminTrace(code.trim().toUpperCase());
      setTraceData(res);
      setActiveCode(code.trim().toUpperCase());
    } catch (err: any) {
      setError(err?.message || 'Batch code not found.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(inputCode);
  };

  const handleInsertEvent = () => {
    toast('Manual event insertion coming soon.', { icon: '🔧' });
  };

  return (
    <div className="space-y-6 bg-white min-h-screen pb-16">
      {/* Page heading */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[#111827] font-display">Trace Lookup</h1>
        <p className="text-sm text-text-secondary">
          Full unredacted traceability — admin view with contact details.
        </p>
      </div>

      {/* ── Search card ── */}
      <SectionCard title="Batch Code Lookup">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Enter batch code e.g. AGC-TOM-2024-001…"
              className="form-input w-full pl-9 pr-3 py-2 text-sm font-mono h-10"
            />
          </div>
          <Button type="submit" variant="primary" isLoading={loading}>
            Look Up
          </Button>
        </form>
      </SectionCard>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-[#FEF2F2] border border-[#DC2626]/20 rounded-card text-sm text-[#DC2626]">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* ── Results ── */}
      {traceData && !loading && (
        <div className="space-y-6">
          {/* Trace header */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-lg font-bold text-[#111827]">{traceData.batchCode}</span>
            <span className="text-text-secondary text-sm">{formatCrop(traceData.cropType)}</span>
            <Badge
              variant={traceData.qualityGrade === 'A' ? 'success' : traceData.qualityGrade === 'B' ? 'warning' : 'neutral'}
              label={`Grade ${traceData.qualityGrade}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left — timeline */}
            <div className="lg:col-span-2 space-y-6">
              <SectionCard title="Journey Timeline">
                <TraceTimeline trace={traceData} />
              </SectionCard>

              {/* Delivery info if present */}
              {traceData.deliveryInfo && (
                <div className="flex items-start gap-3 p-4 bg-[#EAF4EE] border border-[#2D6A4F]/20 rounded-card text-sm text-[#2D6A4F]">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Delivered Successfully</p>
                    <p className="text-xs text-[#2D6A4F]/80">
                      {formatTs(traceData.deliveryInfo.deliveredAt)}
                      {traceData.deliveryInfo.buyerType && ` · ${traceData.deliveryInfo.buyerType}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Manual event insertion */}
              <SectionCard title="Insert Manual Event">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
                      Event Type
                    </label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="form-input w-full text-sm h-10"
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>{eventLabel(t)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
                      Notes (optional)
                    </label>
                    <textarea
                      value={eventNotes}
                      onChange={(e) => setEventNotes(e.target.value)}
                      placeholder="Add any additional context for this event…"
                      className="form-input w-full text-sm min-h-[80px] resize-none"
                    />
                  </div>
                  <Button variant="primary" onClick={handleInsertEvent}>
                    Insert Event
                  </Button>
                </div>
              </SectionCard>
            </div>

            {/* Right — Admin Info card */}
            <div className="space-y-4">
              <div
                className="bg-white rounded-card border border-[#E5E7EB] p-5 space-y-4 shadow-card"
                style={{ borderTop: '3px solid #D97706' }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                  <h3 className="text-sm font-bold text-[#111827]">Admin Info</h3>
                </div>

                {/* Warning note */}
                <div className="bg-[#FFFBEB] border border-[#D97706]/20 rounded-lg p-3 text-xs text-[#92400E] font-medium leading-relaxed">
                  ⚠ Sensitive — do not share externally.
                </div>

                {/* Farmer */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Farmer
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <span className="font-semibold text-[#111827]">{traceData.farmer.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <span className="font-mono text-text-secondary">{traceData.farmer.phone}</span>
                  </div>
                  {traceData.farmer.region && (
                    <p className="text-xs text-text-muted pl-6">
                      {traceData.farmer.district}, {traceData.farmer.region}
                    </p>
                  )}
                </div>

                {/* Buyer (if delivered) */}
                {traceData.deliveryInfo?.buyerName && (
                  <>
                    <div className="border-t border-[#F3F4F6]" />
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        Buyer
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-[#2563EB] shrink-0" />
                        <span className="font-semibold text-[#111827]">
                          {traceData.deliveryInfo.buyerName}
                        </span>
                      </div>
                      {traceData.deliveryInfo.buyerPhone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-[#2563EB] shrink-0" />
                          <span className="font-mono text-text-secondary">
                            {traceData.deliveryInfo.buyerPhone}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Inputs used */}
                {traceData.inputsUsed.length > 0 && (
                  <>
                    <div className="border-t border-[#F3F4F6]" />
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        Inputs Used
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {traceData.inputsUsed.map((inp, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[#EAF4EE] text-[#2D6A4F] text-[10px] font-semibold rounded-full border border-[#2D6A4F]/10"
                          >
                            🌱 {inp}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTracePage;
