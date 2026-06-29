'use client';

import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type QType = 'text' | 'textarea' | 'select' | 'multiselect';

interface Question {
  id: string;
  industry: string;
  key: string;
  label: string;
  type: QType;
  options: string[];
  placeholder: string;
  required: boolean;
  order: number;
  dependsOnKey: string | null;
  dependsOnValue: string | null;
  isActive: boolean;
}

const TYPES: QType[] = ['text', 'textarea', 'select', 'multiselect'];

// Questions under this reserved industry are shown on every industry's form.
const COMMON_INDUSTRY = '__all__';
const industryLabel = (i: string) => (i === COMMON_INDUSTRY ? 'All industries (common)' : i);

const EMPTY: Omit<Question, 'id'> = {
  industry: '',
  key: '',
  label: '',
  type: 'text',
  options: [],
  placeholder: '',
  required: false,
  order: 0,
  dependsOnKey: null,
  dependsOnValue: null,
  isActive: true,
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Question | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ questions: Question[] }>('/admin/questions');
      setQuestions(data.questions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byIndustry = useMemo(() => {
    const map: Record<string, Question[]> = {};
    for (const q of questions) (map[q.industry] ??= []).push(q);
    return map;
  }, [questions]);

  async function remove(q: Question) {
    if (!confirm(`Delete "${q.label}"?`)) return;
    try {
      await apiFetch(`/admin/questions/${q.id}`, { method: 'DELETE' });
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <main className="animate-fade-up px-6 py-10 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Questionnaire</h1>
          <p className="mt-1 text-slate-600">Manage the guided-intake questions by industry.</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary px-4 py-2 text-sm">
          <Plus className="h-4 w-4" /> Add question
        </button>
      </div>

      {error && (
        <div className="card mt-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="card mt-6 grid place-items-center py-16 text-slate-500">Loading…</div>
      ) : questions.length === 0 ? (
        <div className="card mt-6 grid place-items-center py-16 text-slate-500">
          No questions yet — add one.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(byIndustry).map(([industry, list]) => (
            <div key={industry} className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
                {industryLabel(industry)} <span className="text-slate-400">({list.length})</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {list.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {q.label}
                        {q.required && <span className="ml-1 text-red-500">*</span>}
                        {!q.isActive && <span className="ml-2 text-xs text-slate-400">(hidden)</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        <code className="text-slate-600">{q.key}</code> · {q.type}
                        {q.dependsOnKey && (
                          <span> · shows if {q.dependsOnKey} = “{q.dependsOnValue}”</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => setEditing(q)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => remove(q)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <QuestionEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(q) => {
            setQuestions((prev) => {
              const exists = prev.some((x) => x.id === q.id);
              return exists ? prev.map((x) => (x.id === q.id ? q : x)) : [...prev, q];
            });
            setEditing(null);
          }}
          onError={setError}
        />
      )}
    </main>
  );
}

function QuestionEditor({
  initial,
  onClose,
  onSaved,
  onError,
}: {
  initial: Question | null;
  onClose: () => void;
  onSaved: (q: Question) => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState<Omit<Question, 'id'>>(initial ?? EMPTY);
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Omit<Question, 'id'>>(key: K, value: Omit<Question, 'id'>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const needsOptions = form.type === 'select' || form.type === 'multiselect';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      options: needsOptions
        ? optionsText.split(',').map((o) => o.trim()).filter(Boolean)
        : [],
      dependsOnKey: form.dependsOnKey || null,
      dependsOnValue: form.dependsOnValue || null,
    };
    try {
      const res = initial
        ? await apiFetch<{ question: Question }>(`/admin/questions/${initial.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ question: Question }>('/admin/questions', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      onSaved(res.question);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form onSubmit={save} className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {initial ? 'Edit question' : 'Add question'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Industry</label>
              <input
                className="input"
                value={form.industry}
                onChange={(e) => set('industry', e.target.value)}
                placeholder="e.g. Fintech, or __all__"
                required
              />
              <p className="mt-1 text-xs text-slate-400">Use __all__ to show on every industry.</p>
            </div>
            <div>
              <label className="label">Key</label>
              <input
                className="input"
                value={form.key}
                onChange={(e) => set('key', e.target.value)}
                placeholder="lowercase_id"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Label (the question)</label>
            <input className="input" value={form.label} onChange={(e) => set('label', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => set('type', e.target.value as QType)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Order</label>
              <input
                type="number"
                className="input"
                value={form.order}
                onChange={(e) => set('order', Number(e.target.value))}
              />
            </div>
          </div>

          {needsOptions && (
            <div>
              <label className="label">Options (comma-separated)</label>
              <input className="input" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
            </div>
          )}

          <div>
            <label className="label">Placeholder</label>
            <input className="input" value={form.placeholder} onChange={(e) => set('placeholder', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Shows only if key</label>
              <input
                className="input"
                value={form.dependsOnKey ?? ''}
                onChange={(e) => set('dependsOnKey', e.target.value || null)}
                placeholder="(optional)"
              />
            </div>
            <div>
              <label className="label">…equals value</label>
              <input
                className="input"
                value={form.dependsOnValue ?? ''}
                onChange={(e) => set('dependsOnValue', e.target.value || null)}
                placeholder="(optional)"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.required} onChange={(e) => set('required', e.target.checked)} />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              Active
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save question'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
