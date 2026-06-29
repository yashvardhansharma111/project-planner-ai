'use client';

import { ArrowLeft, Download, Eye, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiDownload, apiFetch } from '@/lib/api';

type Status = 'draft' | 'in_review' | 'approved' | 'locked' | 'archived';
const STATUSES: Status[] = ['draft', 'in_review', 'approved', 'locked', 'archived'];

interface Owner {
  id: string;
  fullName: string;
  email: string;
}
interface Project {
  id: string;
  name: string;
  industry?: string;
  description?: string;
  budgetRange?: string;
  status: Status;
  ownerId: Owner | string;
  deadline?: string | null;
  createdAt: string;
}
interface Doc {
  id: string;
  docType: 'prd' | 'trd';
  isApproved: boolean;
  version: number;
}

function fmt(d?: string | null): string {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export default function AdminProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ project: Project; documents: Doc[] }>(
        `/admin/projects/${params.id}`,
      );
      setProject(data.project);
      setDocs(data.documents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(status: Status) {
    if (!project) return;
    try {
      const { project: updated } = await apiFetch<{ project: Project }>(
        `/admin/projects/${project.id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change status');
    }
  }

  async function download(docType: 'prd' | 'trd') {
    try {
      await apiDownload(`/documents/${params.id}/${docType}/download`, `${docType}.md`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function remove() {
    if (!project) return;
    if (!confirm(`Delete "${project.name}"? This removes its documents, tasks, and milestones — and cannot be undone.`))
      return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/admin/projects/${project.id}`, { method: 'DELETE' });
      router.push('/admin/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  const owner = project && typeof project.ownerId === 'object' ? project.ownerId : null;

  return (
    <main className="px-6 py-10 lg:px-8">
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      {error && (
        <div className="card mt-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="mt-10 text-slate-500">Loading…</div>
      ) : !project ? (
        <div className="mt-10 text-slate-500">Project not found.</div>
      ) : (
        <div className="animate-fade-up mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{project.name}</h1>
            <div className="flex items-center gap-2">
              <select
                value={project.status}
                onChange={(e) => changeStatus(e.target.value as Status)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <button
                onClick={remove}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="card mt-6 p-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3 lg:grid-cols-5">
              <Field label="Owner" value={owner ? `${owner.fullName} · ${owner.email}` : '—'} />
              <Field label="Industry" value={project.industry || '—'} />
              <Field label="Budget" value={project.budgetRange || '—'} />
              <Field label="Deadline" value={fmt(project.deadline)} />
              <Field label="Created" value={fmt(project.createdAt)} />
            </dl>
            {project.description && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <dt className="mb-1 text-xs uppercase tracking-wide text-slate-400">Description</dt>
                <dd className="whitespace-pre-wrap text-sm text-slate-700">{project.description}</dd>
              </div>
            )}
          </div>

          {/* Documents */}
          <h2 className="mt-8 text-lg font-semibold text-slate-900">Documents</h2>
          {docs.length === 0 ? (
            <div className="card mt-3 p-6 text-sm text-slate-500">No documents generated yet.</div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {docs.map((d) => (
                <div key={d.id} className="card flex items-center justify-between p-4">
                  <div>
                    <div className="font-semibold uppercase text-slate-900">{d.docType}</div>
                    <div className="text-xs text-slate-500">
                      v{d.version} ·{' '}
                      {d.isApproved ? (
                        <span className="text-emerald-700">Approved</span>
                      ) : (
                        <span className="text-amber-700">Draft</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/documents/${project.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                    <button
                      onClick={() => download(d.docType)}
                      className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      <Download className="h-3.5 w-3.5" /> {d.docType.toUpperCase()}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
    </div>
  );
}
