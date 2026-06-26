'use client';

import { ArrowLeft, Check, Send, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, apiStream } from '@/lib/api';

type Turn = { role: 'user' | 'assistant'; content: string };

interface Draft {
  name: string;
  industry: string;
  description: string;
  budgetRange: string;
  completeness: number;
}

const GREETING: Turn = {
  role: 'assistant',
  content:
    "Hi! I'll help you scope your project. To start — what do you want to build, and who is it for?",
};

// Quick replies to speed up common answers (shown early in the conversation).
const CHIPS = [
  "It's a mobile app",
  "It's a web app",
  'For businesses (B2B)',
  'For consumers (B2C)',
  'Budget around ₹20L',
  'MVP in 3 months',
];

const READY_AT = 85; // completeness % at which we nudge "Create project"

export default function ChatIntakePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Turn[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, streamingText]);

  const hasUserTurn = messages.some((m) => m.role === 'user');

  /** Background extract — keeps the live requirements panel + meter fresh. */
  async function refreshDraft(history: Turn[]) {
    setExtracting(true);
    try {
      const { project } = await apiFetch<{ project: Draft }>('/ai/chat/extract', {
        method: 'POST',
        body: JSON.stringify({ messages: history }),
      });
      setDraft(project);
    } catch {
      /* non-critical */
    } finally {
      setExtracting(false);
    }
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    setStreamingText('');
    setError(null);

    let acc = '';
    try {
      try {
        // Preferred path: stream the reply token-by-token.
        await apiStream('/ai/chat/stream', { messages: next }, (chunk) => {
          acc += chunk;
          setStreamingText(acc);
        });
        if (!acc) throw new Error('empty stream');
      } catch {
        // Fallback: non-streaming reply (e.g. proxy buffering / older browser).
        const { reply } = await apiFetch<{ reply: string }>('/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ messages: next }),
        });
        acc = reply;
      }
      const finalMsgs: Turn[] = [...next, { role: 'assistant', content: acc }];
      setMessages(finalMsgs);
      void refreshDraft(finalMsgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setStreamingText('');
      setSending(false);
    }
  }

  async function openCreate() {
    setError(null);
    if (!draft) await refreshDraft(messages);
    setShowDraft(true);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <button
          onClick={openCreate}
          disabled={!hasUserTurn || sending}
          className={`btn-primary px-4 py-2 text-sm ${
            draft && draft.completeness >= READY_AT ? 'animate-pulse' : ''
          }`}
        >
          <Sparkles className="h-4 w-4" /> Create project
        </button>
      </div>

      <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900">Chat with AI</h1>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Conversation column */}
        <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col">
          <div className="card flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}
            {sending && <Bubble role="assistant" content={streamingText} typing={!streamingText} />}
            <div ref={endRef} />
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {/* Suggestion chips (early in the chat) */}
          {messages.length <= 3 && !sending && (
            <div className="mt-3 flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => void send(c)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              className="input"
              placeholder="Type your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary px-4 py-2.5" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Live requirements panel */}
        <RequirementsPanel draft={draft} extracting={extracting} onCreate={openCreate} />
      </div>

      {showDraft && draft && (
        <DraftModal
          draft={draft}
          onClose={() => setShowDraft(false)}
          onError={setError}
          onCreated={(id) => router.push(`/dashboard/projects/${id}`)}
        />
      )}
    </main>
  );
}

function Bubble({
  role,
  content,
  typing,
}: {
  role: 'user' | 'assistant';
  content: string;
  typing?: boolean;
}) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
          role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'
        }`}
      >
        {typing ? <span className="text-slate-400">Thinking…</span> : content}
      </div>
    </div>
  );
}

function RequirementsPanel({
  draft,
  extracting,
  onCreate,
}: {
  draft: Draft | null;
  extracting: boolean;
  onCreate: () => void;
}) {
  const pct = draft?.completeness ?? 0;
  const ready = pct >= READY_AT;

  return (
    <aside className="card h-fit p-4 lg:sticky lg:top-20">
      <h2 className="text-sm font-semibold text-slate-900">What I understand so far</h2>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-slate-500">Requirements</span>
          <span className={`font-semibold ${ready ? 'text-emerald-600' : 'text-slate-700'}`}>
            {pct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              ready ? 'bg-emerald-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <PanelField label="Name" value={draft?.name} />
        <PanelField label="Industry" value={draft?.industry} />
        <PanelField label="Budget" value={draft?.budgetRange} />
      </dl>
      {draft?.description && (
        <p className="mt-3 line-clamp-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {draft.description}
        </p>
      )}

      {extracting && <p className="mt-3 text-xs text-slate-400">Updating…</p>}

      {ready && (
        <button onClick={onCreate} className="btn-primary mt-4 w-full justify-center px-3 py-2 text-sm">
          <Sparkles className="h-4 w-4" /> Looks ready — create
        </button>
      )}
    </aside>
  );
}

function PanelField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={value ? 'text-slate-800' : 'text-slate-400'}>{value || '—'}</dd>
    </div>
  );
}

/** Editable confirmation of the extracted draft before the project is created. */
function DraftModal({
  draft,
  onClose,
  onError,
  onCreated,
}: {
  draft: Draft;
  onClose: () => void;
  onError: (m: string) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [industry, setIndustry] = useState(draft.industry);
  const [budgetRange, setBudgetRange] = useState(draft.budgetRange);
  const [description, setDescription] = useState(draft.description);
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { project } = await apiFetch<{ project: { id: string } }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          industry: industry || undefined,
          description: description || undefined,
          budgetRange: budgetRange || undefined,
        }),
      });
      onCreated(project.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not create project');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form onSubmit={create} className="card w-full max-w-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Review project draft</h2>
            <p className="mt-0.5 text-sm text-slate-500">Tweak anything before we create it.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label">Project name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Industry</label>
              <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <div>
              <label className="label">Budget</label>
              <input className="input" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[140px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={saving}>
            <Check className="h-4 w-4" /> {saving ? 'Creating…' : 'Create project'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
