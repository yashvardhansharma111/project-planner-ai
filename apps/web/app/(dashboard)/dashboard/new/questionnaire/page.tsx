'use client';

import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type QType = 'text' | 'textarea' | 'select' | 'multiselect';

interface Question {
  id: string;
  key: string;
  label: string;
  type: QType;
  options: string[];
  placeholder?: string;
  required?: boolean;
  dependsOnKey?: string | null;
  dependsOnValue?: string | null;
}

type Answer = string | string[];

// Minimal client-side fallback if the question bank can't be loaded.
const FALLBACK: Record<string, Question[]> = {
  Other: [
    { id: 'idea', key: 'idea', label: 'Describe your project idea', type: 'textarea', options: [], placeholder: 'What are you building and for whom?', required: true },
    { id: 'features', key: 'features', label: 'Key features', type: 'textarea', options: [], placeholder: 'List the must-have capabilities' },
  ],
};

const STEPS = ['Basics', 'Details', 'Budget & review'];

export default function QuestionnairePage() {
  const router = useRouter();
  const [bank, setBank] = useState<Record<string, Question[]>>(FALLBACK);
  const [industries, setIndustries] = useState<string[]>(Object.keys(FALLBACK));
  const [common, setCommon] = useState<Question[]>([]);
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [deadline, setDeadline] = useState('');
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load the admin-managed question bank (falls back to the built-in set).
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{
          industries: string[];
          byIndustry: Record<string, Question[]>;
          common?: Question[];
        }>('/questions');
        if (data.industries.length > 0) {
          setBank(data.byIndustry);
          setIndustries(data.industries);
        }
        if (data.common) setCommon(data.common);
      } catch {
        /* keep fallback */
      }
    })();
  }, []);

  // Common questions (platform, auth, features…) come first, then industry ones.
  const allQuestions = useMemo(
    () => (industry ? [...common, ...(bank[industry] ?? [])] : []),
    [common, bank, industry],
  );

  // Conditional visibility: a question shows only when its dependency matches.
  const visibleQuestions = useMemo(
    () =>
      allQuestions.filter((q) => {
        if (!q.dependsOnKey) return true;
        const dep = answers[q.dependsOnKey];
        if (Array.isArray(dep)) return dep.includes(q.dependsOnValue ?? '');
        return dep === q.dependsOnValue;
      }),
    [allQuestions, answers],
  );

  const setAnswer = useCallback((key: string, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  function hasAnswer(a: Answer | undefined): boolean {
    if (Array.isArray(a)) return a.length > 0;
    return !!a && a.trim().length > 0;
  }

  // Per-step validation gates the Next/Create buttons.
  const stepValid = useMemo(() => {
    if (step === 0) return name.trim().length > 0 && industry.length > 0;
    if (step === 1) return visibleQuestions.filter((q) => q.required).every((q) => hasAnswer(answers[q.key]));
    return true;
  }, [step, name, industry, visibleQuestions, answers]);

  function compileBrief(): string {
    const lines = [`Industry: ${industry}`, ''];
    for (const q of visibleQuestions) {
      const a = answers[q.key];
      const text = Array.isArray(a) ? a.join(', ') : a?.trim();
      if (text) lines.push(`${q.label}\n→ ${text}\n`);
    }
    return lines.join('\n');
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    const raw = compileBrief();

    // Polish the raw answers into a structured brief (fall back to raw on error).
    let description = raw;
    try {
      setStatusMsg('Polishing your brief with AI…');
      const enriched = await apiFetch<{ description: string }>('/ai/enrich', {
        method: 'POST',
        body: JSON.stringify({ text: raw }),
      });
      if (enriched.description) description = `${enriched.description}\n\n---\nRaw answers:\n${raw}`;
    } catch {
      /* use raw */
    }

    try {
      setStatusMsg('Creating project…');
      const { project } = await apiFetch<{ project: { id: string } }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          industry,
          description,
          budgetRange: budgetRange || undefined,
          deadline: deadline || undefined,
        }),
      });
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setSubmitting(false);
      setStatusMsg('');
    }
  }

  return (
    <main className="px-6 py-12 lg:px-8">
      <Link
        href="/dashboard/new/chat"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to chat
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Guided questionnaire</h1>
      <p className="mt-1 text-slate-600">A few quick sections — we’ll build a polished brief.</p>

      {/* Progress */}
      <div className="mt-6 max-w-3xl">
        <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? 'text-indigo-600' : ''}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="card animate-fade-up mt-6 max-w-3xl space-y-5 p-6">
        {/* Step 1 — basics */}
        {step === 0 && (
          <>
            <div>
              <label className="label">Project name</label>
              <input
                className="input"
                placeholder="e.g. NeoBank wallet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Industry</label>
              <select
                className="input"
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  setAnswers({});
                }}
                required
              >
                <option value="" disabled>
                  Select an industry…
                </option>
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Step 2 — industry questions */}
        {step === 1 && (
          <div className="space-y-4">
            {visibleQuestions.length === 0 ? (
              <p className="text-sm text-slate-500">No extra questions for this industry — continue.</p>
            ) : (
              visibleQuestions.map((q) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  value={answers[q.key]}
                  onChange={(v) => setAnswer(q.key, v)}
                />
              ))
            )}
          </div>
        )}

        {/* Step 3 — budget, deadline, review */}
        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Budget range</label>
                <input
                  className="input"
                  placeholder="$10k–$50k"
                  value={budgetRange}
                  onChange={(e) => setBudgetRange(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Deadline</label>
                <input
                  type="date"
                  className="input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{name || '—'}</p>
              <p className="text-xs text-slate-500">{industry}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{compileBrief()}</p>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
            className="btn-ghost px-4 py-2 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!stepValid}
              className="btn-primary px-4 py-2 disabled:opacity-50"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !name || !industry}
              className="btn-primary px-4 py-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" /> {statusMsg || 'Working…'}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Create project
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function QuestionField({
  question: q,
  value,
  onChange,
}: {
  question: Question;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  const str = typeof value === 'string' ? value : '';
  const arr = Array.isArray(value) ? value : [];

  return (
    <div>
      <label className="label">
        {q.label}
        {q.required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {q.type === 'textarea' ? (
        <textarea
          className="input min-h-[80px] resize-y bg-white"
          placeholder={q.placeholder}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : q.type === 'select' ? (
        <select className="input bg-white" value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : q.type === 'multiselect' ? (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => {
            const active = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(active ? arr.filter((x) => x !== o) : [...arr, o])}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {active && <Check className="mr-1 inline h-3 w-3" />}
                {o}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          className="input bg-white"
          placeholder={q.placeholder}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
