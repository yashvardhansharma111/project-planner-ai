import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { ProjectModel } from '@/server/models/Project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'in_review', 'approved', 'locked', 'archived']),
});

export const PATCH = handler<{ params: { id: string } }>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'admin');
  const { status } = await parseBody(req, updateStatusSchema);
  const project = await ProjectModel.findByIdAndUpdate(
    params.id,
    { status },
    { new: true, runValidators: true },
  ).populate('ownerId', 'fullName email');
  if (!project) throw new ApiError(404, 'Project not found');
  return NextResponse.json({ project });
});
