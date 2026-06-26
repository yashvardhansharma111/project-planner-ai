'use client';

import { DollarSign, FileText, FolderKanban, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '@/lib/api';

interface Stats {
  users: { total: number; client: number; tech: number; admin: number };
  projects: {
    total: number;
    draft: number;
    in_review: number;
    approved: number;
    locked: number;
    archived: number;
  };
  documents: { total: number; approved: number };
  revenue: { estimatedTotal: number; byIndustry: { name: string; value: number }[] };
  projectsByMonth: { name: string; value: number }[];
}

const PIE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#94a3b8'];

// Budgets are stored in USD; show the estimated pipeline in INR (Lakh/Crore).
const USD_TO_INR = 83;
const inrFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function money(usd: number): string {
  return inrFmt.format(usd * USD_TO_INR);
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await apiFetch<Stats>('/admin/stats'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusData = stats
    ? [
        { name: 'Draft', value: stats.projects.draft },
        { name: 'In review', value: stats.projects.in_review },
        { name: 'Approved', value: stats.projects.approved },
        { name: 'Locked', value: stats.projects.locked },
        { name: 'Archived', value: stats.projects.archived },
      ]
    : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Analytics</h1>
        <p className="mt-1 text-slate-600">Platform activity and pipeline at a glance.</p>
      </div>

      {error && (
        <div className="card mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* KPI cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Users" value={stats?.users.total} loading={loading} icon={Users} tint="text-indigo-600 bg-indigo-50" />
        <Kpi label="Projects" value={stats?.projects.total} loading={loading} icon={FolderKanban} tint="text-sky-600 bg-sky-50" />
        <Kpi label="Documents" value={stats?.documents.total} loading={loading} icon={FileText} tint="text-emerald-600 bg-emerald-50" />
        <Kpi
          label="Est. revenue"
          value={stats ? money(stats.revenue.estimatedTotal) : undefined}
          loading={loading}
          icon={DollarSign}
          tint="text-amber-600 bg-amber-50"
          hint="estimated from project budgets (INR)"
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Projects created (last 6 months)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats?.projectsByMonth ?? []} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Projects by status">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusData} margin={{ left: -20, right: 8, top: 8 }}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Estimated revenue by industry">
          {stats && stats.revenue.byIndustry.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stats.revenue.byIndustry}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {stats.revenue.byIndustry.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-[240px] place-items-center text-sm text-slate-400">No data</div>
          )}
          {stats && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {stats.revenue.byIndustry.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name} · {money(d.value)}
                </span>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Users by role">
          <div className="flex h-[240px] flex-col justify-center gap-5 px-2">
            <RoleBar label="Clients" value={stats?.users.client ?? 0} total={stats?.users.total ?? 0} color="bg-slate-400" />
            <RoleBar label="Developers" value={stats?.users.tech ?? 0} total={stats?.users.total ?? 0} color="bg-sky-500" />
            <RoleBar label="Admins" value={stats?.users.admin ?? 0} total={stats?.users.total ?? 0} color="bg-indigo-500" />
          </div>
        </ChartCard>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  loading,
  icon: Icon,
  tint,
  hint,
}: {
  label: string;
  value?: number | string;
  loading: boolean;
  icon: typeof Users;
  tint: string;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tint}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{loading ? '—' : (value ?? 0)}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function RoleBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
