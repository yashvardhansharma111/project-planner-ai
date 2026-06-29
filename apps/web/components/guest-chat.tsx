'use client';

import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { Dumbbell, GraduationCap, Lock, Plus, Send, Sparkles, Store, Utensils, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { homePathForRole, useAuth } from '@/lib/auth';
import { Brand } from './brand';

type Turn = { role: 'user' | 'assistant'; content: string };

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const STORAGE_KEY = 'guestChat';
const GUEST_MAX_TURNS = 12; // mirrors the server cap

const GREETING: Turn = {
  role: 'assistant',
  content:
    "Hi! I'm your AI project assistant. Tell me what you want to build and who it's for — I'll help you scope it. When it's ready, sign in to generate your documents.",
};

// Starter project ideas shown on the empty (hero) state.
const HERO_PROMPTS = [
  { icon: Utensils, text: 'A food delivery app for my city' },
  { icon: Dumbbell, text: 'A fitness app with an AI coach' },
  { icon: Store, text: 'A marketplace for local sellers' },
  { icon: GraduationCap, text: 'An online learning platform' },
];

/** Public, no-login chatbot landing. Guests scope a project, then sign in at the
 *  generate step — their conversation is preserved and turned into a project. */
export function GuestChat() {
  const router = useRouter();
  const { user, loading, login, register, loginWithGoogle } = useAuth();

  const [messages, setMessages] = useState<Turn[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  // 'generate' → build the project from the chat after auth; 'login' → just sign in.
  const [authIntent, setAuthIntent] = useState<'generate' | 'login'>('generate');
  const [wallMode, setWallMode] = useState<'login' | 'register'>('register');
  // True from the moment a wall sign-in starts, so the "already logged in →
  // redirect" guard below doesn't yank the guest away mid-claim.
  const [claiming, setClaiming] = useState(false);
  const [finishing, setFinishing] = useState(false);

  function openWall(intent: 'generate' | 'login', mode: 'login' | 'register') {
    setAuthIntent(intent);
    setWallMode(mode);
    setError(null);
    setShowAuth(true);
  }
  const endRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  // Restore any in-progress guest conversation (once, on mount).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Turn[];
        if (Array.isArray(parsed) && parsed.length > 1) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
    loadedRef.current = true;
  }, []);

  // Persist the transcript so a refresh never loses their work. Guarded so the
  // initial greeting-only state can't overwrite a restored conversation.
  useEffect(() => {
    if (!loadedRef.current || messages.length <= 1) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // A logged-in visitor who lands here (and isn't mid-claim) goes to their app.
  useEffect(() => {
    if (!loading && user && !claiming) router.replace(homePathForRole(user.role));
  }, [loading, user, claiming, router]);

  const userTurns = messages.filter((m) => m.role === 'user').length;
  const hasUserTurn = userTurns > 0;
  const limitReached = userTurns >= GUEST_MAX_TURNS;

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || sending || limitReached) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const { reply } = await apiFetch<{ reply: string }>('/public/chat', {
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

  /** After sign-in: turn the saved conversation into a real project. */
  async function claimAndCreate() {
    setFinishing(true);
    try {
      const { project } = await apiFetch<{
        project: { name: string; industry: string; description: string; budgetRange: string };
      }>('/ai/chat/extract', { method: 'POST', body: JSON.stringify({ messages }) });
      const { project: created } = await apiFetch<{ project: { id: string } }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: project.name,
          industry: project.industry || undefined,
          description: project.description || undefined,
          budgetRange: project.budgetRange || undefined,
        }),
      });
      localStorage.removeItem(STORAGE_KEY);
      router.replace(`/dashboard/projects/${created.id}?generate=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your project');
      setFinishing(false);
      setClaiming(false);
      setShowAuth(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 lg:px-6">
        <Brand />
        <div className="flex items-center gap-2">
          <button
            onClick={() => openWall('login', 'login')}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Log in
          </button>
          <button
            onClick={() => openWall('login', 'register')}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Sign up for free
          </button>
        </div>
      </header>

      {hasUserTurn ? (
        /* ── Active conversation ── */
        <>
          <div className="flex-1 overflow-y-auto px-4 lg:px-8">
            <div className="mx-auto max-w-3xl space-y-5 py-6">
              {messages.map((m, i) => (
                <Message key={i} role={m.role} content={m.content} />
              ))}
              {sending && <Typing />}
              <div ref={endRef} />
            </div>
          </div>

          <div className="px-4 pb-4 lg:px-8">
            <div className="mx-auto max-w-3xl">
              {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
              {limitReached && (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  You've reached the guest limit. Sign in to keep chatting and generate your documents.
                </div>
              )}
              <div className="flex items-center gap-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                  className="flex flex-1 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 shadow-sm focus-within:border-slate-400 focus-within:shadow-md"
                >
                  <input
                    className="flex-1 bg-transparent px-2 py-2 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50"
                    placeholder={limitReached ? 'Sign in to continue…' : 'Message the assistant…'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={limitReached}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-30"
                    disabled={sending || !input.trim() || limitReached}
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                <button
                  onClick={() => openWall('generate', 'register')}
                  disabled={!hasUserTurn}
                  className="btn-primary shrink-0 px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> Create project
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-slate-400">
                Sign in to generate your PRD, TRD and more — your chat is saved.
              </p>
            </div>
          </div>
        </>
      ) : (
        /* ── Empty hero state ── */
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> RoadmapAI · project assistant
          </span>
          <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            What do you want to <span className="gradient-text">build</span>?
          </h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="w-full max-w-2xl"
          >
            <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 shadow-sm transition-shadow focus-within:border-slate-400 focus-within:shadow-md">
              <Plus className="ml-1 h-5 w-5 shrink-0 text-slate-400" />
              <input
                className="flex-1 bg-transparent px-1 py-2 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Describe the app or product you want to build…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-30"
                disabled={sending || !input.trim()}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
            {HERO_PROMPTS.map(({ icon: Icon, text }) => (
              <button
                key={text}
                onClick={() => void send(text)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-700"
              >
                <Icon className="h-4 w-4 shrink-0 text-indigo-500" /> {text}
              </button>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            No account needed to start · Sign in when you're ready to generate documents.
          </p>
        </div>
      )}

      {showAuth && (
        <AuthWall
          intent={authIntent}
          initialMode={wallMode}
          onClose={() => !claiming && setShowAuth(false)}
          busy={claiming || finishing}
          onGoogle={async (idToken) => {
            setError(null);
            if (authIntent === 'generate') setClaiming(true);
            try {
              await loginWithGoogle(idToken);
              if (authIntent === 'generate') await claimAndCreate();
              else setShowAuth(false); // redirect effect sends them to their app
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Google sign-in failed');
              setClaiming(false);
            }
          }}
          onEmail={async (mode, fields) => {
            setError(null);
            if (authIntent === 'generate') setClaiming(true);
            try {
              if (mode === 'login') await login(fields.email, fields.password);
              else await register(fields.fullName, fields.email, fields.password);
              if (authIntent === 'generate') await claimAndCreate();
              else setShowAuth(false);
            } catch (err) {
              setClaiming(false);
              throw err; // surfaced inside the wall
            }
          }}
        />
      )}
    </div>
  );
}

function Message({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={`animate-fade-up flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          isUser
            ? 'bg-slate-200 text-xs font-semibold text-slate-600'
            : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
        }`}
      >
        {isUser ? 'You' : <Sparkles className="h-4 w-4" />}
      </span>
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

function AuthWall({
  intent,
  initialMode,
  onClose,
  busy,
  onGoogle,
  onEmail,
}: {
  intent: 'generate' | 'login';
  initialMode: 'login' | 'register';
  onClose: () => void;
  busy: boolean;
  onGoogle: (idToken: string) => void | Promise<void>;
  onEmail: (
    mode: 'login' | 'register',
    fields: { fullName: string; email: string; password: string },
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const forGenerate = intent === 'generate';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await onEmail(mode, { fullName, email, password });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Lock className="h-4 w-4 text-indigo-600" />{' '}
              {forGenerate ? 'Sign in to generate' : 'Log in or sign up'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {forGenerate
                ? "Your conversation is saved — we'll turn it into a project."
                : 'Continue to your projects and documents.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {busy ? (
          <div className="grid place-items-center gap-2 py-10 text-slate-500">
            <Sparkles className="h-6 w-6 animate-pulse text-indigo-500" />
            {forGenerate ? 'Creating your project…' : 'Signing you in…'}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {GOOGLE_CLIENT_ID && (
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(cr) => {
                      if (cr.credential) void onGoogle(cr.credential);
                    }}
                    onError={() => setErr('Google sign-in failed')}
                    text="continue_with"
                    width="340"
                  />
                </div>
              </GoogleOAuthProvider>
            )}

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === 'register' && (
                <input
                  className="input"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              )}
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="input"
                placeholder={mode === 'register' ? 'Create a password (8+ chars)' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'register' ? 8 : undefined}
                required
              />
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting
                  ? 'Please wait…'
                  : mode === 'register'
                    ? forGenerate
                      ? 'Create account & generate'
                      : 'Create account'
                    : forGenerate
                      ? 'Sign in & generate'
                      : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500">
              {mode === 'register' ? 'Already have an account? ' : "Don't have an account? "}
              <button
                onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                {mode === 'register' ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
