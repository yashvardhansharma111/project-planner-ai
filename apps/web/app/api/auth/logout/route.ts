import { NextResponse } from 'next/server';
import { clearRefreshCookie } from '@/server/auth';
import { handler } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async () => {
  const res = NextResponse.json({ message: 'Logged out' });
  clearRefreshCookie(res);
  return res;
});
