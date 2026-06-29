import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { MilestoneModel } from '@/server/models/Milestone';
import { ProjectModel } from '@/server/models/Project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const milestoneCreateSchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.coerce.date().nullable().optional(),
});

export const POST = handler<{ params: { projectId: string } }>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'tech', 'admin');
  const { title, dueDate } = await parseBody(req, milestoneCreateSchema);

  const project = await ProjectModel.findById(params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  const count = await MilestoneModel.countDocuments({ projectId: project._id });
  const milestone = await MilestoneModel.create({
    projectId: project._id,
    title,
    dueDate: dueDate ?? null,
    order: count,
  });
  return NextResponse.json({ milestone }, { status: 201 });
});
