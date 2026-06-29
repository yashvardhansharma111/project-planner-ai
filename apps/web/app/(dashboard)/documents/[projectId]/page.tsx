'use client';

import { ArrowLeft, BadgeCheck, Check, Download, FileText, Lock, Pencil, Printer, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiDownload, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type DocType = 'prd' | 'trd' | 'brd' | 'srs' | 'api_docs' | 'db_schema';

const DOC_TYPES: DocType[] = ['prd', 'trd', 'brd', 'srs', 'api_docs', 'db_schema'];
const DOC_LABEL: Record<DocType, string> = {
  prd: 'PRD',
  trd: 'TRD',
  brd: 'BRD',
  srs: 'SRS',
  api_docs: 'API Docs',
  db_schema: 'DB Schema',
};

interface AiDoc {
  id: string;
  docType: DocType;
  content: string;
  isApproved: boolean;
  version: number;
  generatedBy?: string | null;
  updatedAt: string;
}

interface Project {
  id: string;
  status: string;
}

export default function DocumentsPage({ params }: { params: { projectId: string } }) {
  const { user } = useAuth();
  const canEdit = user?.role !== 'tech'; // owner/admin can edit; tech is read-only

  const [docs, setDocs] = useState<AiDoc[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [active, setActive] = useState<DocType>('prd');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<DocType | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const [docData, proj] = await Promise.all([
        apiFetch<{ documents: AiDoc[] }>(`/documents/${params.projectId}`),
        apiFetch<{ project: Project }>(`/projects/${params.projectId}`).catch(() => null),
      ]);
      setDocs(docData.documents);
      setProject(proj?.project ?? null);
      if (docData.documents[0]) setActive(docData.documents[0].docType);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setFetching(false);
    }
  }, [params.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = docs.find((d) => d.docType === active);
  const locked = project?.status === 'locked';
  const canGenerate = canEdit && !!project && !locked;

  function switchTab(t: DocType) {
    setEditing(false);
    setActive(t);
  }

  function startEdit() {
    if (!current) return;
    setDraft(current.content);
    setEditing(true);
  }

  async function save() {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const { document } = await apiFetch<{ document: AiDoc }>(`/documents/${current.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: draft }),
      });
      setDocs((prev) => prev.map((d) => (d.id === document.id ? document : d)));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function generate(docType: DocType) {
    setGenerating(docType);
    setError(null);
    try {
      await apiFetch(`/ai/generate/${params.projectId}`, {
        method: 'POST',
        body: JSON.stringify({ docTypes: [docType] }),
      });
      await load();
      setActive(docType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(null);
    }
  }

  async function download(docType: DocType) {
    try {
      await apiDownload(`/documents/${params.projectId}/${docType}/download`, `${docType}.md`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function approve() {
    if (!current) return;
    setError(null);
    try {
      const { document } = await apiFetch<{ document: AiDoc }>(`/documents/${current.id}/approve`, {
        method: 'PATCH',
      });
      setDocs((prev) => prev.map((d) => (d.id === document.id ? document : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="no-print">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>

        {/* Tabs — all doc types; existing ones are active, missing ones are dimmed */}
        <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {DOC_TYPES.map((t) => {
            const exists = docs.some((d) => d.docType === t);
            return (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active === t
                    ? 'bg-indigo-600 text-white'
                    : exists
                      ? 'text-slate-700 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {DOC_LABEL[t]}
                {!exists && <span className="ml-1 text-xs opacity-70">+</span>}
              </button>
            );
          })}
        </div>

        {current && !editing && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Version {current.version}</span>
              <span>·</span>
              <span>{current.generatedBy || 'unknown'}</span>
              <span>·</span>
              {current.isApproved ? (
                <span className="text-emerald-700">Approved</span>
              ) : (
                <span className="text-amber-700">Draft (not approved)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && !current.isApproved && (
                <button
                  onClick={approve}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <BadgeCheck className="h-4 w-4" /> Approve
                </button>
              )}
              {canEdit && !locked && (
                <button onClick={startEdit} className="btn-ghost px-3 py-2 text-sm">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              {canGenerate && (
                <button
                  onClick={() => generate(active)}
                  disabled={generating === active}
                  className="btn-ghost px-3 py-2 text-sm disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> {generating === active ? 'Regenerating…' : 'Regenerate'}
                </button>
              )}
              <button onClick={() => download(active)} className="btn-ghost px-3 py-2 text-sm">
                <Download className="h-4 w-4" /> Markdown
              </button>
              <button onClick={() => window.print()} className="btn-primary px-3 py-2 text-sm">
                <Printer className="h-4 w-4" /> Print / PDF
              </button>
            </div>
          </div>
        )}

        {editing && (
          <div className="mt-3 flex items-center gap-2">
            <button onClick={save} className="btn-primary px-3 py-2 text-sm" disabled={saving}>
              <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost px-3 py-2 text-sm" disabled={saving}>
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        )}

        {error && (
          <div className="card mt-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}
      </div>

      {/* Body */}
      {fetching ? (
        <div className="mt-10 text-slate-500">Loading…</div>
      ) : editing && current ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="input mt-6 min-h-[60vh] resize-y font-mono text-sm leading-relaxed"
          spellCheck={false}
        />
      ) : current ? (
        <article className="print-area prose prose-slate mt-6 max-w-none rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{current.content}</Markdown>
        </article>
      ) : (
        // Selected a doc type that doesn't exist yet.
        <div className="card mt-6 grid place-items-center gap-3 py-16 text-center">
          <FileText className="h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-700">No {DOC_LABEL[active]} yet</p>
          {canGenerate ? (
            <button
              onClick={() => generate(active)}
              disabled={generating === active}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {generating === active ? `Generating ${DOC_LABEL[active]}…` : `Generate ${DOC_LABEL[active]}`}
            </button>
          ) : locked ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Lock className="h-4 w-4" /> Project is finalised.
            </p>
          ) : (
            <p className="text-sm text-slate-500">Not generated yet.</p>
          )}
        </div>
      )}
    </main>
  );
}
