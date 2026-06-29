import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { MilestoneModel } from '@/server/models/Milestone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { milestoneId: string } };

const milestoneUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.enum(['pending', 'done']).optional(),
  order: z.number().int().min(0).optional(),
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'tech', 'admin');
  const body = await parseBody(req, milestoneUpdateSchema);
  const milestone = await MilestoneModel.findByIdAndUpdate(params.milestoneId, body, {
    new: true,
    runValidators: true,
  });
  if (!milestone) throw new ApiError(404, 'Milestone not found');
  return NextResponse.json({ milestone });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'tech', 'admin');
  const result = await MilestoneModel.findByIdAndDelete(params.milestoneId);
  if (!result) throw new ApiError(404, 'Milestone not found');
  return new NextResponse(null, { status: 204 });
});
