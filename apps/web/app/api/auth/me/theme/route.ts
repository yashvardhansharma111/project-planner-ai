import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateThemeSchema = z.object({ theme: z.enum(['light', 'dark']) });

export const PATCH = handler(async (req) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const { theme } = await parseBody(req, updateThemeSchema);
  const user = await UserModel.findByIdAndUpdate(sub, { theme }, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'User not found');
  return NextResponse.json({ user: user.toJSON() });
});
