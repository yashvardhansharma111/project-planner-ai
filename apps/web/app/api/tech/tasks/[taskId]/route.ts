import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { TaskModel } from '@/server/models/Task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { taskId: string } };

const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  order: z.number().int().min(0).optional(),
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'tech', 'admin');
  const body = await parseBody(req, taskUpdateSchema);
  const task = await TaskModel.findByIdAndUpdate(params.taskId, body, {
    new: true,
    runValidators: true,
  });
  if (!task) throw new ApiError(404, 'Task not found');
  return NextResponse.json({ task });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'tech', 'admin');
  const result = await TaskModel.findByIdAndDelete(params.taskId);
  if (!result) throw new ApiError(404, 'Task not found');
  return new NextResponse(null, { status: 204 });
});
