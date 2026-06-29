'use client';

import {
  CalendarClock,
  ChevronDown,
  Download,
  Eye,
  FolderOpen,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDownload, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Project {
  id: string;
  name: string;
  industry?: string;
  description?: string;
  status: 'draft' | 'in_review' | 'approved' | 'locked' | 'archived';
  deadline?: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<Project['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  locked: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

type SortKey = 'newest' | 'oldest' | 'deadline' | 'name';

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Project['status']>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ projects: Project[] }>('/projects');
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter(
      (p) =>
        (statusFilter === 'all' || p.status === statusFilter) &&
        (!q || p.name.toLowerCase().includes(q) || (p.industry ?? '').toLowerCase().includes(q)),
    );
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return +new Date(a.createdAt) - +new Date(b.createdAt);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'deadline':
          return (a.deadline ? +new Date(a.deadline) : Infinity) - (b.deadline ? +new Date(b.deadline) : Infinity);
        default:
          return +new Date(b.createdAt) - +new Date(a.createdAt);
      }
    });
    return list;
  }, [projects, query, statusFilter, sort]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.fullName.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-slate-600">
            Your projects <span className="text-slate-400">({projects.length})</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost px-3 py-2 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <Link href="/dashboard/new" className="btn-primary px-4 py-2 text-sm">
            <Plus className="h-4 w-4" /> New Project
          </Link>
        </div>
      </div>

      {/* Controls */}
      {projects.length > 0 && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <select
              className="input w-full appearance-none pr-9 sm:w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All statuses</option>
              {(['draft', 'in_review', 'approved', 'locked', 'archived'] as const).map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative w-full sm:w-auto">
            <select
              className="input w-full appearance-none pr-9 sm:w-auto"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="deadline">By deadline</option>
              <option value="name">By name</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      )}

      {error && (
        <div className="card mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="card grid place-items-center py-16 text-slate-500">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="card grid place-items-center gap-3 py-20 text-center">
            <FolderOpen className="h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">No projects yet</p>
            <Link href="/dashboard/new" className="btn-primary px-4 py-2 text-sm">
              <Plus className="h-4 w-4" /> Create your first project
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="card grid place-items-center py-16 text-slate-500">
            No projects match your filters.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

interface DocMeta {
  id: string;
  docType: 'prd' | 'trd';
  isApproved: boolean;
}

function ProjectCard({ project }: { project: Project }) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      const data = await apiFetch<{ documents: DocMeta[] }>(`/documents/${project.id}`);
      setDocs(data.documents);
    } catch {
      /* no docs yet */
    }
  }, [project.id]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  async function download(docType: 'prd' | 'trd') {
    setDownloading(docType);
    setError(null);
    try {
      await apiDownload(`/documents/${project.id}/${docType}/download`, `${slug}-${docType}.md`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  const created = new Date(project.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const hasDocs = docs.length > 0;
  const finalised = project.status === 'locked';

  return (
    <div className="card animate-fade-up flex flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="font-semibold text-slate-900 hover:text-indigo-700 hover:underline"
        >
          {project.name}
        </Link>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[project.status]}`}
        >
          {project.status.replace('_', ' ')}
        </span>
      </div>
      {project.industry && (
        <p className="mt-1 text-xs uppercase tracking-wide text-indigo-600">{project.industry}</p>
      )}
      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{project.description}</p>
      )}
      {project.deadline && (
        <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          <CalendarClock className="h-3.5 w-3.5" /> Due{' '}
          {new Date(project.deadline).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">Created {created}</span>

          {hasDocs ? (
            <div className="flex items-center gap-1.5">
              <Link
                href={`/documents/${project.id}`}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </Link>
              {(['prd', 'trd'] as const).map((t) =>
                docs.some((d) => d.docType === t) ? (
                  <button
                    key={t}
                    onClick={() => download(t)}
                    disabled={downloading === t}
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" /> {t.toUpperCase()}
                  </button>
                ) : null,
              )}
            </div>
          ) : finalised ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              <Lock className="h-3.5 w-3.5" /> Finalised
            </span>
          ) : (
            <Link href={`/dashboard/projects/${project.id}`} className="btn-primary px-3 py-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Generate
            </Link>
          )}
        </div>

        {hasDocs && !finalised && (
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
          >
            <RefreshCw className="h-3 w-3" /> Regenerate
          </Link>
        )}
        {hasDocs && finalised && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400">
            <Lock className="h-3 w-3" /> Finalised — regeneration disabled
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
