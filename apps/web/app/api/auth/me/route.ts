import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const user = await UserModel.findById(sub);
  if (!user) throw new ApiError(404, 'User not found');
  return NextResponse.json({ user: user.toJSON() });
});

const updateMeSchema = z.object({ fullName: z.string().min(1).max(150) });

export const PATCH = handler(async (req) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const { fullName } = await parseBody(req, updateMeSchema);
  const user = await UserModel.findByIdAndUpdate(sub, { fullName }, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'User not found');
  return NextResponse.json({ user: user.toJSON() });
});
