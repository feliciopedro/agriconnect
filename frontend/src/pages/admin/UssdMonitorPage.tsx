import React, { useState, useEffect } from 'react';
import { UssdApi } from '../../api/ussd.api';
import { toast } from 'react-hot-toast';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  List,
  MessageSquare,
  BarChart3,
  Play,
  RotateCw,
  Clock,
  ChevronRight
} from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export const UssdMonitorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'sms' | 'stats'>('sessions');

  // --- Filter states ---
  const [phoneFilter, setPhoneFilter] = useState('');
  const [menuFilter, setMenuFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [smsStatusFilter, setSmsStatusFilter] = useState<string>('all');
  // --- Data states ---
  const [sessions, setSessions] = useState<any[]>([]);
  const [smsQueue, setSmsQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [smsRetrying, setSmsRetrying] = useState(false);

  // --- Fetching logic ---
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sessions') {
        const filters: any = {};
        if (phoneFilter) filters.phone = phoneFilter;
        if (menuFilter) filters.menu = menuFilter;
        if (isActiveFilter !== 'all') filters.isActive = isActiveFilter;
        
        const data = await UssdApi.getUssdSessions(filters);
        setSessions(data);
      } else if (activeTab === 'sms') {
        const filters: any = {};
        if (smsStatusFilter !== 'all') filters.status = smsStatusFilter;
        
        const data = await UssdApi.getSmsQueue(filters);
        setSmsQueue(data);

        // Fetch stats to update SMS strip count
        const statData = await UssdApi.getUssdStats();
        setStats(statData);
      } else if (activeTab === 'stats') {
        const data = await UssdApi.getUssdStats();
        setStats(data);
      }
    } catch (err: any) {
      toast.error(`Error pulling USSD monitor updates: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Poll sessions every 30s
  useEffect(() => {
    fetchData();

    let intervalId: any;
    if (activeTab === 'sessions') {
      intervalId = setInterval(fetchData, 30000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTab, phoneFilter, menuFilter, isActiveFilter, smsStatusFilter]);

  // Open session detail drawer
  const handleSessionClick = async (sessionId: string) => {
    try {
      const details = await UssdApi.getSessionDetails(sessionId);
      setSelectedSession(details);
    } catch (err: any) {
      toast.error(`Failed to load session history details: ${err.message}`);
    }
  };

  // Trigger manual SMS retry
  const handleRetryAll = async () => {
    setSmsRetrying(true);
    try {
      const result = await UssdApi.retrySmsQueue();
      toast.success(`Retry worker completed! Sent: ${result.succeeded}/${result.retried} failed items.`);
      fetchData();
    } catch (err: any) {
      toast.error(`Retry failed: ${err.message}`);
    } finally {
      setSmsRetrying(false);
    }
  };

  // Calculate session duration string
  const formatDuration = (session: any) => {
    const start = new Date(session.startedAt).getTime();
    const end = session.endedAt ? new Date(session.endedAt).getTime() : new Date(session.lastActivityAt).getTime();
    const diffSec = Math.max(1, Math.round((end - start) / 1000));
    
    if (diffSec < 60) return `${diffSec}s`;
    return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-white min-h-screen text-slate-800 relative">
      
      {/* Header view */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-8 h-8 text-indigo-600 animate-spin-slow" />
            USSD Monitor Console
          </h1>
          <p className="text-slate-500 mt-1">
            Real-time analytics, session lifecycles, and outbound message queue monitoring.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Console
        </button>
      </div>

      {/* Tabs selectors */}
      <div className="flex gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition ${
            activeTab === 'sessions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <List className="w-4 h-4" />
          USSD Sessions
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition ${
            activeTab === 'sms'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          SMS Delivery Queue
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition ${
            activeTab === 'stats'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Usage Statistics
        </button>
      </div>

      {/* TAB CONTENT: SESSIONS */}
      {activeTab === 'sessions' && (
        <div>
          {/* Filters strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-150">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone Filter</label>
              <input
                type="text"
                placeholder="Search phone number..."
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg text-slate-700 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Menu Filter</label>
              <input
                type="text"
                placeholder="Search menu state..."
                value={menuFilter}
                onChange={(e) => setMenuFilter(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg text-slate-700 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
              <select
                value={isActiveFilter}
                onChange={(e) => setIsActiveFilter(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg text-slate-700 bg-white"
              >
                <option value="all">All Sessions</option>
                <option value="true">Active Sessions</option>
                <option value="false">Completed Sessions</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setPhoneFilter('');
                  setMenuFilter('');
                  setIsActiveFilter('all');
                }}
                className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 font-semibold"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Sessions Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="py-3.5 px-4">Dialer Phone</th>
                    <th className="py-3.5 px-4">Assigned Role</th>
                    <th className="py-3.5 px-4">Language</th>
                    <th className="py-3.5 px-4">Current Menu</th>
                    <th className="py-3.5 px-4">Last Activity</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-slate-400 py-12">
                        No USSD sessions found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-mono font-bold">{session.phone}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {session.user?.role || 'Guest'}
                        </td>
                        <td className="py-3.5 px-4 uppercase font-bold text-indigo-600">{session.language}</td>
                        <td className="py-3.5 px-4 font-mono bg-slate-100 px-2 rounded-md truncate max-w-[120px]">
                          {session.currentMenu || 'INIT'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(session.lastActivityAt).toLocaleTimeString()}
                        </td>
                        <td className="py-3.5 px-4">{formatDuration(session)}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            session.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {session.isActive ? 'ACTIVE' : 'COMPLETED'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleSessionClick(session.sessionId)}
                            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                          >
                            Trace Logs
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SMS DELIVERY QUEUE */}
      {activeTab === 'sms' && (
        <div>
          {/* SMS stats bar */}
          <div className="grid grid-cols-3 gap-6 mb-6 bg-slate-50 p-4 border border-slate-150 rounded-xl">
            <div className="text-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Sent Today</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{stats?.smsSentToday || 0}</div>
            </div>
            <div className="text-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Failed Today</div>
              <div className="text-2xl font-black text-rose-600 mt-1">{stats?.smsFailedToday || 0}</div>
            </div>
            <div className="text-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Queued/Pending</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">{stats?.smsQueuedToday || 0}</div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <select
                value={smsStatusFilter}
                onChange={(e) => setSmsStatusFilter(e.target.value)}
                className="text-xs py-1.5 px-3 border border-slate-200 rounded-lg text-slate-700 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="SENT">SENT</option>
                <option value="QUEUED">QUEUED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
            <button
              onClick={handleRetryAll}
              disabled={smsRetrying}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {smsRetrying ? 'Retrying...' : 'Retry All Failed'}
            </button>
          </div>

          {/* SMS Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="py-3.5 px-4">Recipient Phone</th>
                    <th className="py-3.5 px-4">Template Trigger</th>
                    <th className="py-3.5 px-4">Message Content</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Attempts</th>
                    <th className="py-3.5 px-4">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {smsQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-400 py-12">
                        No short messages in queue matching filters.
                      </td>
                    </tr>
                  ) : (
                    smsQueue.map((sms) => (
                      <tr key={sms.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-mono font-bold">{sms.toPhone}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">{sms.triggerAction}</td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono italic max-w-sm truncate">
                          "{sms.message}"
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold ${
                            sms.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-700'
                              : sms.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {sms.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold">{sms.attemptCount} / 3</td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {new Date(sms.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: STATISTICS */}
      {activeTab === 'stats' && stats && (
        <div className="flex flex-col gap-8">
          {/* Stats overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Sessions</span>
              <div className="text-3xl font-black text-slate-900">{stats.activeSessions}</div>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sessions Registered Today</span>
              <div className="text-3xl font-black text-slate-900">{stats.sessionsToday}</div>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Call Duration</span>
              <div className="text-3xl font-black text-slate-900">
                {Math.round(stats.avgSessionDurationSeconds)} seconds
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pie Chart: Language splits */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-800">Language Distribution (Preferred)</h3>
              <div className="h-[250px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(stats.languageBreakdown).map(([lang, count]) => ({
                        name: lang.toUpperCase(),
                        value: count
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.entries(stats.languageBreakdown).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs font-bold text-slate-600">
                {Object.entries(stats.languageBreakdown).map(([lang, count], index) => (
                  <span key={lang} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    {lang.toUpperCase()} ({count as any})
                  </span>
                ))}
              </div>
            </div>

            {/* Bar Chart: top paths */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-800">Top Visited Menu Navigation Paths</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topMenuPaths.slice(0, 5)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="path" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DRAWER DETAIL VIEW */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex justify-end z-50 transition-opacity">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col gap-6 animate-slide-in">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Session Audit Trace</h3>
                <span className="text-xs text-slate-400 font-mono">{selectedSession.sessionId}</span>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-1.5 transition"
              >
                ✖
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {/* Properties strip */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Dialer Phone</div>
                  <div className="font-mono font-bold mt-1 text-slate-800">{selectedSession.phone}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">User Language</div>
                  <div className="font-bold mt-1 uppercase text-indigo-600">{selectedSession.language}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Current Step</div>
                  <div className="font-mono mt-1 text-slate-800">{selectedSession.currentMenu} &gt; {selectedSession.currentStep}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Created time</div>
                  <div className="mt-1 text-slate-800">{new Date(selectedSession.startedAt).toLocaleString()}</div>
                </div>
              </div>

              {/* Input History list */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Input history timeline</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50 max-h-[220px] overflow-y-auto">
                  {selectedSession.inputHistory?.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-6">
                      No inputs recorded.
                    </div>
                  ) : (
                    selectedSession.inputHistory.map((inp: string, index: number) => (
                      <div key={index} className="flex gap-4 p-3 text-xs">
                        <span className="font-bold text-slate-400">#{index + 1}</span>
                        <span className="font-mono text-slate-700 bg-white border border-slate-150 px-2 py-0.5 rounded">
                          {inp || '[dial]'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Audit logs checklist */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit log events</h4>
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {selectedSession.auditLogs?.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-6">
                      No audit events recorded.
                    </div>
                  ) : (
                    selectedSession.auditLogs?.map((log: any) => (
                      <div key={log.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-1 text-xs">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className="font-mono">{log.menu} &gt; {log.step}</span>
                        </div>
                        <p className="mt-1 text-slate-700 leading-tight">
                          Input: <strong className="font-mono text-indigo-600 bg-white border px-1 rounded">{log.userInput || '[dial]'}</strong>
                        </p>
                        <p className="text-slate-500 font-mono text-[10px] bg-slate-900 text-emerald-400 p-2 rounded mt-1.5 max-h-[80px] overflow-y-auto leading-tight">
                          {log.systemResponse}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UssdMonitorPage;
