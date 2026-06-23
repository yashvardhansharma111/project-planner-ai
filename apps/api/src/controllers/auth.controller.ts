import bcrypt from 'bcryptjs';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../middleware/error.middleware';
import { UserModel } from '../models/User';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type UserRole,
} from '../utils/jwt';

const BCRYPT_ROUNDS = 12;

// ── Refresh-token cookie ─────────────────────────────────────────────────────
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // mirrors JWT_REFRESH_EXPIRES_IN

const refreshCookieOptions: CookieOptions = {
  httpOnly: true, // not readable from JS — mitigates XSS token theft
  secure: env.NODE_ENV === 'production', // HTTPS-only in prod
  sameSite: 'lax', // sent on top-level navigation, blocks most CSRF
  path: '/api/auth', // only returned to the auth routes that need it
  maxAge: REFRESH_MAX_AGE_MS,
};

/**
 * Issues a fresh access token + sets a rotated refresh cookie, then returns the
 * access token so the handler can include it in the JSON body.
 */
function issueTokens(
  res: Response,
  user: { _id: unknown; email: string; role: UserRole },
): string {
  const sub = String(user._id);
  const accessToken = signAccessToken({ sub, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub });
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  return accessToken;
}

// ── Validation schemas (mirror the `users` collection) ───────────────────────
export const registerSchema = z.object({
  fullName: z.string().min(1).max(150),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

// ── Handlers ─────────────────────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  const { fullName, email, password } = req.body as z.infer<typeof registerSchema>;

  if (await UserModel.exists({ email })) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await UserModel.create({
    fullName,
    email,
    passwordHash,
    role: 'client',
    isActive: true,
  });

  const accessToken = issueTokens(res, user);
  res.status(201).json({ accessToken, user: user.toJSON() });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as z.infer<typeof loginSchema>;

  const user = await UserModel.findOne({ email });
  // Same response whether the email is unknown or the password is wrong —
  // avoids leaking which accounts exist.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'Account is suspended');
  }

  const accessToken = issueTokens(res, user);
  res.json({ accessToken, user: user.toJSON() });
}

export async function me(req: Request, res: Response): Promise<void> {
  // requireAuth guarantees req.user is set.
  const user = await UserModel.findById(req.user!.sub);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user: user.toJSON() });
}

/**
 * Exchanges a valid refresh cookie for a new access token, rotating the refresh
 * cookie in the process. No Authorization header needed — the cookie is auth.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw new ApiError(401, 'Missing refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  // Confirm the user still exists and is active before re-issuing.
  const user = await UserModel.findById(payload.sub);
  if (!user || !user.isActive) {
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    throw new ApiError(401, 'Account no longer active');
  }

  const accessToken = issueTokens(res, user);
  res.json({ accessToken, user: user.toJSON() });
}

/** Clears the refresh cookie. Access tokens expire on their own (≤15m). */
export function logout(_req: Request, res: Response): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.json({ message: 'Logged out' });
}
