'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Status = 'draft' | 'in_review' | 'approved' | 'locked' | 'archived';

interface Owner {
  id: string;
  fullName: string;
  email: string;
}

interface AdminProject {
  id: string;
  name: string;
  industry?: string;
  status: Status;
  ownerId: Owner | string;
  deadline?: string | null;
  createdAt: string;
}

const STATUSES: Status[] = ['draft', 'in_review', 'approved', 'locked', 'archived'];
const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  locked: 'Locked',
  archived: 'Archived',
};

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ projects: AdminProject[] }>('/admin/projects');
      setProjects(data.projects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(id: string, status: Status) {
    setBusyId(id);
    setError(null);
    try {
      const { project } = await apiFetch<{ project: AdminProject }>(
        `/admin/projects/${id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
      setProjects((prev) => prev.map((p) => (p.id === id ? project : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change status');
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const s of STATUSES) c[s] = projects.filter((p) => p.status === s).length;
    return c;
  }, [projects]);

  const visible = filter === 'all' ? projects : projects.filter((p) => p.status === filter);

  return (
    <main className="animate-fade-up px-6 py-10 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Projects</h1>
      <p className="mt-1 text-slate-600">All projects across every client. Drive their lifecycle.</p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {(['all', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === s ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]}{' '}
              <span className={filter === s ? 'text-indigo-100' : 'text-slate-400'}>
                {counts[s] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <button onClick={load} className="text-sm text-slate-500 hover:text-slate-900">
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="card mt-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="card mt-4 overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-16 text-slate-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="grid place-items-center py-16 text-slate-500">No projects in this view.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Deadline</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((p) => {
                const owner = typeof p.ownerId === 'object' ? p.ownerId : null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.industry && <div className="text-xs text-indigo-600">{p.industry}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {owner ? (
                        <>
                          <div className="text-slate-900">{owner.fullName}</div>
                          <div className="text-xs text-slate-500">{owner.email}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={p.status}
                        disabled={busyId === p.id}
                        onChange={(e) => changeStatus(p.id, e.target.value as Status)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 disabled:opacity-50"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {p.deadline
                        ? new Date(p.deadline).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
