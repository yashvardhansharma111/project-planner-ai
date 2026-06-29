'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function ManualProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          industry: industry || undefined,
          description: description || undefined,
          budgetRange: budgetRange || undefined,
          deadline: deadline || undefined,
        }),
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setSubmitting(false);
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

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Quick create</h1>
      <p className="mt-1 text-slate-600">The starting point for your roadmap.</p>

      <form onSubmit={handleSubmit} className="card animate-fade-up mt-8 max-w-3xl p-6">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className="input"
              placeholder="e.g. Fintech onboarding app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="industry">
                Industry
              </label>
              <input
                id="industry"
                className="input"
                placeholder="Fintech, Health…"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="budget">
                Budget range
              </label>
              <input
                id="budget"
                className="input"
                placeholder="$10k–$50k"
                value={budgetRange}
                onChange={(e) => setBudgetRange(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="deadline">
              Deadline <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="deadline"
              type="date"
              className="input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="description"
              className="input min-h-[120px] resize-y"
              placeholder="A sentence or two about the goal — this guides the AI generation…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary px-4 py-2" disabled={submitting}>
              <Plus className="h-4 w-4" /> {submitting ? 'Creating…' : 'Create project'}
            </button>
            <Link href="/dashboard/new/chat" className="btn-ghost px-4 py-2">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </main>
  );
}
