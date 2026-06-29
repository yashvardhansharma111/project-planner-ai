import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateRoleSchema = z.object({ role: z.enum(['client', 'admin', 'tech']) });

export const PATCH = handler<{ params: { id: string } }>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'admin');
  const { role } = await parseBody(req, updateRoleSchema);

  const target = await UserModel.findById(params.id);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.role === 'admin' && role !== 'admin') {
    const adminCount = await UserModel.countDocuments({ role: 'admin' });
    if (adminCount <= 1) throw new ApiError(400, 'Cannot demote the last remaining admin');
  }
  target.role = role;
  await target.save();
  return NextResponse.json({ user: target.toJSON() });
});
