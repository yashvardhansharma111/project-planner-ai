'use client';

import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { homePathForRole, useAuth } from '@/lib/auth';
import { Brand } from './brand';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** Shared login / register form. The two (auth) pages are thin wrappers. */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login';
  const router = useRouter();
  const { user, loading, login, register, loginWithGoogle } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Once signed in (now or after submit), land on the role's home.
  useEffect(() => {
    if (!loading && user) router.replace(homePathForRole(user.role));
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isLogin) await login(email, password);
      else await register(fullName, email, password);
      // Redirect handled by the effect above once `user` is set.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle(idToken: string) {
    setError(null);
    try {
      await loginWithGoogle(idToken);
      // Redirect handled by the effect above once `user` is set.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  return (
    <main className="bg-grid relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 flex justify-center">
          <Brand size="lg" />
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLogin
              ? 'Sign in to generate PRD & TRD documents.'
              : 'Start turning requirements into polished docs.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!isLogin && (
              <div>
                <label className="label" htmlFor="fullName">
                  Full name
                </label>
                <input
                  id="fullName"
                  className="input"
                  placeholder="Ada Lovelace"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder={isLogin ? '••••••••' : 'At least 8 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isLogin ? undefined : 8}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Google sign-in (only when a client ID is configured) */}
          {GOOGLE_CLIENT_ID && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(cr) => {
                      if (cr.credential) void handleGoogle(cr.credential);
                    }}
                    onError={() => setError('Google sign-in failed')}
                    text={isLogin ? 'signin_with' : 'signup_with'}
                    shape="rectangular"
                    width="320"
                  />
                </div>
              </GoogleOAuthProvider>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account? " : 'Already registered? '}
          <Link
            href={isLogin ? '/register' : '/login'}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </Link>
        </p>
      </div>
    </main>
  );
}
