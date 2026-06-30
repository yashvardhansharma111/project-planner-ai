'use client';

import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Eye,
  FileText,
  FolderKanban,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiDownload, apiFetch } from '@/lib/api';

type DocType = 'prd' | 'trd' | 'brd' | 'srs' | 'api_docs' | 'db_schema';
const DOC_LABEL: Record<DocType, string> = {
  prd: 'PRD',
  trd: 'TRD',
  brd: 'BRD',
  srs: 'SRS',
  api_docs: 'API Docs',
  db_schema: 'DB Schema',
};

interface Owner {
  fullName: string;
  email: string;
}
interface Project {
  id: string;
  name: string;
  industry?: string;
  status: string;
  deadline?: string | null;
  ownerId: Owner | string;
}
interface Doc {
  id: string;
  docType: DocType;
  isApproved: boolean;
  version: number;
}
interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
}
interface Milestone {
  id: string;
  title: string;
  dueDate: string | null;
  status: 'pending' | 'done';
}
interface Detail {
  project: Project;
  documents: Doc[];
  tasks: Task[];
  milestones: Milestone[];
}

function fmtDate(d?: string | null): string {
  return d
    ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
}

export default function TechDashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ projects: Project[] }>('/tech/projects');
        setProjects(data.projects);
        if (data.projects[0]) setSelectedId(data.projects[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetail(null);
    try {
      setDetail(await apiFetch<Detail>(`/tech/projects/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  return (
    <main className="px-6 py-8 lg:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Tech workspace</h1>
      <p className="mt-1 text-slate-600">Approved projects, their documents, tasks and milestones.</p>

      {error && (
        <div className="card mt-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
        {/* Project list */}
        <aside className="space-y-2">
          {loading ? (
            <div className="card grid place-items-center py-12 text-slate-500">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="card grid place-items-center gap-2 py-12 text-center text-sm text-slate-500">
              <FolderKanban className="h-8 w-8 text-slate-300" />
              No approved projects yet.
            </div>
          ) : (
            projects.map((p) => {
              const owner = typeof p.ownerId === 'object' ? p.ownerId : null;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`card w-full p-4 text-left transition-colors ${
                    selectedId === p.id ? 'border-indigo-300 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    {p.status === 'locked' ? (
                      <Lock className="h-3.5 w-3.5 text-indigo-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </div>
                  {p.industry && <p className="text-xs uppercase tracking-wide text-indigo-600">{p.industry}</p>}
                  {owner && <p className="mt-1 text-xs text-slate-500">{owner.fullName}</p>}
                </button>
              );
            })
          )}
        </aside>

        {/* Detail */}
        <section>
          {!detail ? (
            <div className="card grid place-items-center py-16 text-slate-500">
              {selectedId ? 'Loading…' : 'Select a project.'}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-900">{detail.project.name}</h2>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">
                    {detail.project.status}
                  </span>
                </div>
                {detail.project.deadline && (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm text-amber-700">
                    <CalendarClock className="h-4 w-4" /> Due {fmtDate(detail.project.deadline)}
                  </p>
                )}
              </div>

              <DocumentsCard projectId={detail.project.id} docs={detail.documents} />
              <TasksCard projectId={detail.project.id} initial={detail.tasks} />
              <MilestonesCard projectId={detail.project.id} initial={detail.milestones} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DocumentsCard({ projectId, docs }: { projectId: string; docs: Doc[] }) {
  async function download(docType: DocType) {
    await apiDownload(`/documents/${projectId}/${docType}/download`, `${docType}.md`).catch(() => {});
  }
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Documents</h3>
      {docs.length === 0 ? (
        <p className="text-sm text-slate-500">No approved documents yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <FileText className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{DOC_LABEL[d.docType]}</span>
              <span className="text-xs text-slate-400">v{d.version}</span>
              <Link href={`/documents/${projectId}`} className="ml-1 text-slate-500 hover:text-indigo-600" title="View">
                <Eye className="h-4 w-4" />
              </Link>
              <button onClick={() => download(d.docType)} className="text-slate-500 hover:text-indigo-600" title="Download">
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TASK_NEXT: Record<Task['status'], Task['status']> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

function TasksCard({ projectId, initial }: { projectId: string; initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [title, setTitle] = useState('');

  async function add() {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    const { task } = await apiFetch<{ task: Task }>(`/tech/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: t }),
    });
    setTasks((prev) => [...prev, task]);
  }

  async function cycle(task: Task) {
    const status = TASK_NEXT[task.status];
    const { task: updated } = await apiFetch<{ task: Task }>(`/tech/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setTasks((prev) => prev.map((x) => (x.id === task.id ? updated : x)));
  }

  async function remove(id: string) {
    await apiFetch(`/tech/tasks/${id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((x) => x.id !== id));
  }

  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        Tasks <span className="text-slate-400">({done}/{tasks.length} done)</span>
      </h3>
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2.5">
            <button onClick={() => cycle(t)} title={t.status} className="shrink-0">
              {t.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : t.status === 'in_progress' ? (
                <Clock className="h-4 w-4 text-amber-500" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
            </button>
            <span className={`flex-1 text-sm ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
              {t.title}
            </span>
            <button onClick={() => remove(t.id)} className="text-slate-300 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {tasks.length === 0 && <li className="text-sm text-slate-400">No tasks yet.</li>}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <input
          className="input"
          placeholder="Add a task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
        />
        <button onClick={add} className="btn-ghost shrink-0 px-3 py-2 text-sm">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}

function MilestonesCard({ projectId, initial }: { projectId: string; initial: Milestone[] }) {
  const [items, setItems] = useState<Milestone[]>(initial);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  async function add() {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    setDue('');
    const { milestone } = await apiFetch<{ milestone: Milestone }>(
      `/tech/projects/${projectId}/milestones`,
      { method: 'POST', body: JSON.stringify({ title: t, dueDate: due || null }) },
    );
    setItems((prev) => [...prev, milestone]);
  }

  async function toggle(m: Milestone) {
    const status = m.status === 'done' ? 'pending' : 'done';
    const { milestone } = await apiFetch<{ milestone: Milestone }>(`/tech/milestones/${m.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setItems((prev) => prev.map((x) => (x.id === m.id ? milestone : x)));
  }

  async function remove(id: string) {
    await apiFetch(`/tech/milestones/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Milestones</h3>
      <ul className="space-y-1.5">
        {items.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5">
            <button onClick={() => toggle(m)} className="shrink-0">
              {m.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
            </button>
            <span className={`flex-1 text-sm ${m.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
              {m.title}
            </span>
            {m.dueDate && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <CalendarClock className="h-3 w-3" /> {fmtDate(m.dueDate)}
              </span>
            )}
            <button onClick={() => remove(m.id)} className="text-slate-300 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-slate-400">No milestones yet.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Add a milestone…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input type="date" className="input sm:w-40" value={due} onChange={(e) => setDue(e.target.value)} />
        <button onClick={add} className="btn-ghost shrink-0 px-3 py-2 text-sm">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}
