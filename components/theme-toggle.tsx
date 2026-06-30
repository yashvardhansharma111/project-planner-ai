'use client';

import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth, type User } from '@/lib/auth';

/**
 * Light/dark preference toggle. The preference is persisted server-side
 * (PATCH /auth/me/theme) and applied to <html> by AuthProvider, which drives the
 * `.dark` styles in globals.css.
 */
export function ThemeToggle() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const isDark = user.theme === 'dark';
  const next = isDark ? 'light' : 'dark';

  async function toggle() {
    if (saving) return;
    setSaving(true);
    try {
      const { user: updated } = await apiFetch<{ user: User }>('/auth/me/theme', {
        method: 'PATCH',
        body: JSON.stringify({ theme: next }),
      });
      updateUser(updated);
    } catch {
      /* preference is non-critical — ignore failures silently */
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
