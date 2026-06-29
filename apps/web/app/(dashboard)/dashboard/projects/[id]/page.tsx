'use client';

import {
  ArrowLeft,
  CalendarClock,
  Check,
  Download,
  Eye,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiDownload, apiFetch } from '@/lib/api';

type Status = 'draft' | 'in_review' | 'approved' | 'locked' | 'archived';
const STATUSES: Status[] = ['draft', 'in_review', 'approved', 'locked', 'archived'];

const STATUS_STYLES: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  locked: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

interface Project {
  id: string;
  name: string;
  industry?: string;
  description?: string;
  budgetRange?: string;
  status: Status;
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
  return d
    ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoOpenedRef = useRef(false);
  const [project, setProject] = useState<Project | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        apiFetch<{ project: Project }>(`/projects/${params.id}`),
        apiFetch<{ documents: Doc[] }>(`/documents/${params.id}`).catch(() => ({ documents: [] })),
      ]);
      setProject(p.project);
      setDocs(d.documents);
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

  // Arriving fresh from intake (?generate=1) → show the feature checklist so the
  // user reviews the final feature list and is prompted to generate.
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (
      project &&
      searchParams.get('generate') === '1' &&
      project.status !== 'locked' &&
      docs.length === 0
    ) {
      setShowChecklist(true);
      autoOpenedRef.current = true;
    }
  }, [project, docs, searchParams]);

  async function remove() {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await apiFetch(`/projects/${params.id}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function finalize() {
    if (
      !confirm(
        'Finalise and lock this project? You will not be able to edit, delete, or regenerate it afterward.',
      )
    )
      return;
    try {
      const { project: updated } = await apiFetch<{ project: Project }>(
        `/projects/${params.id}/finalize`,
        { method: 'POST' },
      );
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalise failed');
    }
  }

  async function generate(features?: string[]) {
    setShowChecklist(false);
    setGenerating(true);
    setError(null);
    try {
      await apiFetch(`/ai/generate/${params.id}`, {
        method: 'POST',
        body: JSON.stringify({ features: features ?? [] }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function updateDeadline(p: Project) {
    setProject(p);
  }

  async function approve(docId: string) {
    setBusy(docId);
    try {
      const { document } = await apiFetch<{ document: Doc }>(`/documents/${docId}/approve`, {
        method: 'PATCH',
      });
      setDocs((prev) => prev.map((d) => (d.id === docId ? document : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(null);
    }
  }

  async function download(docType: 'prd' | 'trd') {
    try {
      await apiDownload(`/documents/${params.id}/${docType}/download`, `${docType}.md`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  return (
    <main className="px-6 py-10 lg:px-8">
      <Link
        href="/dashboard"
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
      ) : editing ? (
        <EditForm
          project={project}
          onCancel={() => setEditing(false)}
          onSaved={(p) => {
            setProject(p);
            setEditing(false);
          }}
          onError={setError}
        />
      ) : (
        <div className="animate-fade-up mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{project.name}</h1>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[project.status]}`}
              >
                {project.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {project.status === 'locked' ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">
                  <Lock className="h-4 w-4" /> Finalised &amp; locked
                </span>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="btn-ghost px-3 py-2 text-sm">
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  <button
                    onClick={finalize}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    <Lock className="h-4 w-4" /> Finalise &amp; lock
                  </button>
                  <button
                    onClick={remove}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card mt-6 p-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3 lg:grid-cols-4">
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
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
            {docs.length > 0 &&
              (project.status === 'locked' ? (
                <span className="inline-flex items-center gap-1 text-sm text-slate-400">
                  <Lock className="h-4 w-4" /> Finalised
                </span>
              ) : (
                <button
                  onClick={() => setShowChecklist(true)}
                  disabled={generating}
                  className="text-sm text-slate-500 hover:text-slate-900 disabled:opacity-50"
                >
                  {generating ? 'Regenerating…' : '↻ Regenerate'}
                </button>
              ))}
          </div>

          {showChecklist && (
            <ChecklistPanel
              projectId={project.id}
              onCancel={() => setShowChecklist(false)}
              onGenerate={generate}
            />
          )}

          {docs.length === 0 ? (
            !showChecklist && (
              <div className="card mt-3 grid place-items-center gap-3 py-12 text-center">
                {project.status === 'locked' ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                    <Lock className="h-4 w-4" /> Project is finalised — unlock it to generate.
                  </p>
                ) : generating ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                    <Sparkles className="h-4 w-4 animate-pulse" /> Generating…
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">No documents yet.</p>
                    <button onClick={() => setShowChecklist(true)} className="btn-primary px-4 py-2 text-sm">
                      <Sparkles className="h-4 w-4" /> Generate PRD/TRD
                    </button>
                  </>
                )}
              </div>
            )
          ) : (
            <>
              {/* Set a deadline before approving the documents (not once locked). */}
              {project.status !== 'locked' && (
                <DeadlineSetter project={project} onSaved={updateDeadline} />
              )}
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
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {!d.isApproved && (
                      <button
                        onClick={() => approve(d.id)}
                        disabled={busy === d.id}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}

/** Pre-generation checklist: AI suggests features, the client edits, then generates. */
function ChecklistPanel({
  projectId,
  onCancel,
  onGenerate,
}: {
  projectId: string;
  onCancel: () => void;
  onGenerate: (features: string[]) => void;
}) {
  const [items, setItems] = useState<{ text: string; checked: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [custom, setCustom] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { features } = await apiFetch<{ features: string[] }>(`/ai/checklist/${projectId}`, {
          method: 'POST',
        });
        if (alive) setItems(features.map((text) => ({ text, checked: true })));
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : 'Could not suggest features');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  function addCustom() {
    const text = custom.trim();
    if (!text) return;
    setItems((prev) => [...prev, { text, checked: true }]);
    setCustom('');
  }

  const selected = items.filter((i) => i.checked).map((i) => i.text);

  return (
    <div className="card animate-fade-up mt-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Review the feature checklist</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Tick the features to include, or add your own — the PRD/TRD will cover these.
          </p>
        </div>
        <button onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
          <Sparkles className="h-4 w-4 animate-pulse" /> Suggesting features…
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {items.map((it, idx) => (
              <li key={idx} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={it.checked}
                  onChange={() =>
                    setItems((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, checked: !p.checked } : p)),
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`text-sm ${it.checked ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                  {it.text}
                </span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-sm text-slate-500">No suggestions — add features below.</li>
            )}
          </ul>

          <div className="mt-3 flex items-center gap-2">
            <input
              className="input"
              placeholder="Add a feature…"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button onClick={addCustom} className="btn-ghost shrink-0 px-3 py-2 text-sm">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button onClick={() => onGenerate(selected)} className="btn-primary px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4" /> Generate with {selected.length} feature
              {selected.length === 1 ? '' : 's'}
            </button>
            <button onClick={onCancel} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Lets the client set/update the project deadline before approving documents. */
function DeadlineSetter({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (p: Project) => void;
}) {
  const saved = project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) : '';
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);
  const dirty = value !== saved; // only show the Save button when the date changed

  async function save() {
    setSaving(true);
    try {
      const { project: updated } = await apiFetch<{ project: Project }>(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deadline: value ? value : null }),
      });
      onSaved(updated);
    } catch {
      /* surfaced via parent on next load */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card mt-3 flex flex-wrap items-end gap-3 p-4">
      <div className="flex-1">
        <label className="label flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-slate-400" /> Project deadline
        </label>
        <input
          type="date"
          className="input sm:max-w-xs"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">
          {dirty
            ? 'Set a deadline before approving the documents.'
            : project.deadline
              ? `Deadline set for ${fmt(project.deadline)}.`
              : 'No deadline set yet.'}
        </p>
      </div>
      {dirty && (
        <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 text-sm">
          <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save deadline'}
        </button>
      )}
    </div>
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

function EditForm({
  project,
  onCancel,
  onSaved,
  onError,
}: {
  project: Project;
  onCancel: () => void;
  onSaved: (p: Project) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [industry, setIndustry] = useState(project.industry ?? '');
  const [budgetRange, setBudgetRange] = useState(project.budgetRange ?? '');
  const [status, setStatus] = useState<Status>(project.status);
  const [deadline, setDeadline] = useState(
    project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) : '',
  );
  const [description, setDescription] = useState(project.description ?? '');
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { project: updated } = await apiFetch<{ project: Project }>(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          industry,
          budgetRange,
          status,
          description,
          deadline: deadline ? deadline : null,
        }),
      });
      onSaved(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card animate-fade-up mt-4 max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-bold text-slate-900">Edit project</h1>
      <div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Industry</label>
          <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div>
          <label className="label">Budget range</label>
          <input className="input" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Deadline</label>
          <input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="input min-h-[120px] resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary px-4 py-2" disabled={saving}>
          <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
