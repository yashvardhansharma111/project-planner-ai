// Same-origin by default: the API now lives in this Next app under /api.
// (Set NEXT_PUBLIC_API_URL only if you point at a separate API host.)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

// Access token lives in memory + localStorage (the refresh token is an
// HTTP-only cookie the browser sends automatically with credentials: 'include').
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('accessToken', token);
    else localStorage.removeItem('accessToken');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('accessToken');
  }
  return accessToken;
}

// Endpoints that must NOT trigger a refresh-retry (avoids loops).
const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/logout', '/auth/register'];

// De-duped refresh: many concurrent 401s share one refresh round-trip.
let refreshing: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (r) => {
        if (!r.ok) return false;
        const d = await r.json();
        setAccessToken(d.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Session truly expired → clear token and send the user to login. */
function forceLogout(): void {
  setAccessToken(null);
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

/** Thin fetch wrapper: prefixes /api, attaches the bearer token, parses JSON,
 *  sends cookies, transparently refreshes an expired token, and logs the user
 *  out if the refresh fails. Throws a friendly Error on non-2xx responses. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // Access token expired: refresh once and retry, else log out.
  if (res.status === 401 && !_retried && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await tryRefresh()) return apiFetch<T>(path, options, true);
    forceLogout();
    throw new Error('Session expired — please sign in again');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }
  return data as T;
}

/**
 * POST a request and stream the plain-text response body token-by-token.
 * Calls `onToken` for each chunk. Falls back to the caller on non-OK responses
 * (throws) and transparently refreshes an expired access token once.
 */
export async function apiStream(
  path: string,
  body: unknown,
  onToken: (chunk: string) => void,
  _retried = false,
): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 && !_retried) {
    if (await tryRefresh()) return apiStream(path, body, onToken, true);
    forceLogout();
    throw new Error('Session expired — please sign in again');
  }

  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = JSON.parse(await res.text());
      msg = j.error || j.message || msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onToken(decoder.decode(value, { stream: true }));
  }
}

/** Fetch a file (with auth + refresh-retry) and trigger a browser download. */
export async function apiDownload(path: string, filename: string, _retried = false): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401 && !_retried) {
    if (await tryRefresh()) return apiDownload(path, filename, true);
    forceLogout();
    throw new Error('Session expired — please sign in again');
  }

  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const j = JSON.parse(await res.text());
      msg = j.error || j.message || msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
