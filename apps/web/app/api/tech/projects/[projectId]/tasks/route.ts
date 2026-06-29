import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { ProjectModel } from '@/server/models/Project';
import { TaskModel } from '@/server/models/Task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const taskCreateSchema = z.object({ title: z.string().min(1).max(200) });

export const POST = handler<{ params: { projectId: string } }>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'tech', 'admin');
  const { title } = await parseBody(req, taskCreateSchema);

  const project = await ProjectModel.findById(params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  const count = await TaskModel.countDocuments({ projectId: project._id });
  const task = await TaskModel.create({ projectId: project._id, title, order: count });
  return NextResponse.json({ task }, { status: 201 });
});
