import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from './env';
import { ApiError } from './http';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  type AccessTokenPayload,
  type UserRole,
} from './jwt';

// ── Access token (Authorization: Bearer) ─────────────────────────────────────
export function getAuth(req: Request): AccessTokenPayload | null {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyAccessToken(header.slice('Bearer '.length).trim());
  } catch {
    return null;
  }
}

export function requireAuth(req: Request): AccessTokenPayload {
  const payload = getAuth(req);
  if (!payload) throw new ApiError(401, 'Missing or invalid token');
  return payload;
}

export function requireRole(req: Request, ...roles: UserRole[]): AccessTokenPayload {
  const payload = requireAuth(req);
  if (!roles.includes(payload.role)) throw new ApiError(403, 'Insufficient permissions');
  return payload;
}

// ── Refresh-token cookie (HTTP-only) ─────────────────────────────────────────
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // seconds (mirrors JWT_REFRESH_EXPIRES_IN)

export function setRefreshCookie(res: NextResponse, token: string): void {
  res.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax', // same-origin now → lax is enough
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 0,
  });
}

export function readRefreshCookie(): string | undefined {
  return cookies().get(REFRESH_COOKIE)?.value;
}

/**
 * Build the standard auth response: `{ accessToken, user }` JSON + a rotated
 * refresh cookie. Used by register / login / google / refresh.
 */
export function authResponse(
  user: { _id: unknown; email: string; role: string; toJSON: () => unknown },
  status = 200,
): NextResponse {
  const sub = String(user._id);
  const accessToken = signAccessToken({ sub, email: user.email, role: user.role as UserRole });
  const res = NextResponse.json({ accessToken, user: user.toJSON() }, { status });
  setRefreshCookie(res, signRefreshToken({ sub }));
  return res;
}
