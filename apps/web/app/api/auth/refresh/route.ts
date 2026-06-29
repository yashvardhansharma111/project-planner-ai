import { NextResponse } from 'next/server';
import { authResponse, clearRefreshCookie, readRefreshCookie } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler } from '@/server/http';
import { verifyRefreshToken } from '@/server/jwt';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async () => {
  await connectDB();
  const token = readRefreshCookie();
  if (!token) throw new ApiError(401, 'Missing refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || !user.isActive) {
    const res = NextResponse.json({ error: 'Account no longer active' }, { status: 401 });
    clearRefreshCookie(res);
    return res;
  }

  return authResponse(user);
});
