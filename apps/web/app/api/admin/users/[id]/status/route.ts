import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateUserStatusSchema = z.object({ isActive: z.boolean() });

export const PATCH = handler<{ params: { id: string } }>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'admin');
  const { isActive } = await parseBody(req, updateUserStatusSchema);

  const target = await UserModel.findById(params.id);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.role === 'admin' && !isActive) {
    const activeAdmins = await UserModel.countDocuments({ role: 'admin', isActive: true });
    if (activeAdmins <= 1) throw new ApiError(400, 'Cannot suspend the last active admin');
  }
  target.isActive = isActive;
  await target.save();
  return NextResponse.json({ user: target.toJSON() });
});
