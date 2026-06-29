'use client';

import { ArrowLeft, ListChecks, MessageSquare, Send, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Turn = { role: 'user' | 'assistant'; content: string };

const GREETING: Turn = {
  role: 'assistant',
  content:
    "Hi! I'll help you scope your project. To start — what do you want to build, and who is it for?",
};

// Quick replies to speed up common answers (one nudges the tech-stack question).
const CHIPS = [
  "It's a mobile app",
  "It's a web app",
  'For consumers (B2C)',
  'We prefer React & Node.js',
  'No tech-stack preference',
  'Budget around ₹20L',
];

function initials(name?: string): string {
  if (!name) return 'You';
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ChatIntakePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Turn[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const hasUserTurn = messages.some((m) => m.role === 'user');

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const { reply } = await apiFetch<{ reply: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: next }),
      });
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setSending(false);
    }
  }

  async function createProject() {
    setCreating(true);
    setError(null);
    try {
      const { project } = await apiFetch<{
        project: { name: string; industry: string; description: string; budgetRange: string };
      }>('/ai/chat/extract', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });
      const { project: created } = await apiFetch<{ project: { id: string } }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: project.name,
          industry: project.industry || undefined,
          description: project.description || undefined,
          budgetRange: project.budgetRange || undefined,
        }),
      });
      router.push(`/dashboard/projects/${created.id}?generate=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project');
      setCreating(false);
    }
  }

  return (
    <main className="flex h-[calc(100vh-3.5rem)] flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> My Projects
            </Link>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <h1 className="hidden items-center gap-2 text-sm font-semibold text-slate-900 sm:flex">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              AI Project Assistant
            </h1>
          </div>
          <button
            onClick={createProject}
            disabled={!hasUserTurn || creating || sending}
            className="btn-primary px-4 py-2 text-sm"
          >
            <Sparkles className="h-4 w-4" />
            {creating ? 'Creating…' : 'Create project'}
          </button>
        </div>

        {/* Intake method switcher */}
        <div className="mx-auto mt-3 flex max-w-3xl flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">
            <MessageSquare className="h-4 w-4" /> Chat with AI
          </span>
          <Link
            href="/dashboard/new/questionnaire"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <ListChecks className="h-4 w-4" /> Guided questionnaire
          </Link>
          <Link
            href="/dashboard/new/manual"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <Zap className="h-4 w-4" /> Quick form
          </Link>
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5 py-6">
          {messages.map((m, i) => (
            <Message key={i} role={m.role} content={m.content} userName={user?.fullName} />
          ))}
          {sending && <Typing />}

          {/* First-run suggestion chips */}
          {!hasUserTurn && (
            <div className="flex flex-wrap gap-2 pl-11">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => void send(c)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-700"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 bg-white px-4 py-3 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
          >
            <input
              className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Message the assistant…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-slate-400">
            The assistant will ask about your goal, users, features, and preferred tech stack.
          </p>
        </div>
      </div>
    </main>
  );
}

function Message({
  role,
  content,
  userName,
}: {
  role: 'user' | 'assistant';
  content: string;
  userName?: string;
}) {
  const isUser = role === 'user';
  return (
    <div className={`animate-fade-up flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {isUser ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
          {initials(userName)}
        </span>
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
      )}
      {/* Bubble */}
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'rounded-tr-sm bg-indigo-600 text-white'
            : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
      </div>
    </div>
  );
}
