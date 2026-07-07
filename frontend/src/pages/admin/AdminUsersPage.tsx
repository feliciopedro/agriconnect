import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Search,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AdminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// ─── Role chip ───────────────────────────────────────────────────────────────

const ROLES = ['ALL', 'FARMER', 'BUYER', 'TRANSPORT', 'ADMIN'] as const;
type RoleFilter = (typeof ROLES)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleBadge(role: string) {
  switch (role.toUpperCase()) {
    case 'FARMER':
      return <Badge variant="success" label="Farmer" size="sm" />;
    case 'BUYER':
      return <Badge variant="primary" label="Buyer" size="sm" />;
    case 'TRANSPORT':
      return <Badge variant="warning" label="Transport" size="sm" />;
    case 'ADMIN':
    case 'SUPERADMIN':
      return <Badge variant="info" label="Admin" size="sm" />;
    default:
      return <Badge variant="neutral" label={role} size="sm" />;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = React.useState<RoleFilter>('ALL');
  const [unverifiedOnly, setUnverifiedOnly] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [page, setPage] = React.useState(1);

  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', selectedRole, unverifiedOnly, search, page],
    queryFn: () =>
      AdminApi.getUsers({
        role: selectedRole === 'ALL' ? undefined : selectedRole,
        isVerified: unverifiedOnly ? false : undefined,
        search: search || undefined,
        page,
        limit,
      }),
    placeholderData: (prev) => prev,
  });

  const verifyMutation = useMutation({
    mutationFn: AdminApi.verifyUser,
    onSuccess: () => {
      toast.success('User verified successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to verify user'),
  });

  const users = data?.users ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleRoleChange = (r: RoleFilter) => {
    setSelectedRole(r);
    setPage(1);
  };

  return (
    <div className="space-y-6 bg-white min-h-screen pb-16">
      {/* Page heading */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[#111827] font-display">Users</h1>
        <p className="text-sm text-text-secondary">
          Manage accounts, verify identities, and look up traceability.
        </p>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-card p-4 space-y-3">
        {/* Role chips */}
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => handleRoleChange(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                selectedRole === r
                  ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                  : 'bg-white text-text-secondary border-[#E5E7EB] hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
              }`}
            >
              {r}
            </button>
          ))}

          {/* Unverified toggle */}
          <button
            onClick={() => {
              setUnverifiedOnly((v) => !v);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
              unverifiedOnly
                ? 'bg-[#DC2626] text-white border-[#DC2626]'
                : 'bg-white text-text-secondary border-[#E5E7EB] hover:border-[#DC2626] hover:text-[#DC2626]'
            }`}
          >
            Unverified only
          </button>
        </div>

        {/* Search input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or phone…"
              className="form-input w-full pl-9 pr-3 py-2 text-sm h-10"
            />
          </div>
          <button
            type="submit"
            className="px-4 h-10 bg-[#2D6A4F] hover:bg-[#235A41] text-white text-sm font-semibold rounded-btn transition-colors cursor-pointer shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-card border border-[#E5E7EB] overflow-hidden shadow-card">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-text-secondary font-medium">
            No users found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                <tr>
                  {['Name', 'Phone', 'Role', 'Region', 'Verified', 'Joined', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3 font-semibold text-[#111827] whitespace-nowrap">
                      {user.name}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">
                      {user.phone}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">{roleBadge(user.role)}</td>

                    {/* Region */}
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {user.region || '—'}
                    </td>

                    {/* Verified */}
                    <td className="px-4 py-3">
                      {user.isVerified ? (
                        <CheckCircle className="w-5 h-5 text-[#2D6A4F]" />
                      ) : (
                        <XCircle className="w-5 h-5 text-[#DC2626]" />
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                      {formatDate(user.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Verify button */}
                        {!user.isVerified && (
                          <button
                            onClick={() => verifyMutation.mutate(user.id)}
                            disabled={verifyMutation.isPending}
                            className="flex items-center gap-1 text-xs font-bold text-[#2D6A4F] hover:text-[#235A41] bg-transparent border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verify
                          </button>
                        )}

                        {/* Trace link */}
                        <button
                          onClick={() => navigate(`/admin/trace`)}
                          title="Go to trace lookup"
                          className="p-1.5 text-text-muted hover:text-[#2D6A4F] hover:bg-[#EAF4EE] rounded-md transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-white">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-[#111827] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      p === page
                        ? 'bg-[#2D6A4F] text-white'
                        : 'text-text-secondary hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 7 && (
                <span className="text-xs text-text-muted px-1">… {totalPages}</span>
              )}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-[#111827] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Row count */}
        {!isLoading && pagination && (
          <div className="px-4 py-2 border-t border-[#F3F4F6] bg-[#FAFAFA]">
            <p className="text-xs text-text-muted">
              Showing {users.length} of {pagination.total} users
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
