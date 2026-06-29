import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { ProjectModel } from '@/server/models/Project';
import { updateProjectSchema } from '@/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export const GET = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const project = await ProjectModel.findOne({ _id: params.id, ownerId: sub });
  if (!project) throw new ApiError(404, 'Project not found');
  return NextResponse.json({ project });
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const body = await parseBody(req, updateProjectSchema);

  const existing = await ProjectModel.findOne({ _id: params.id, ownerId: sub });
  if (!existing) throw new ApiError(404, 'Project not found');
  if (existing.status === 'locked') {
    throw new ApiError(409, 'Project is finalised and locked — no further edits allowed');
  }
  const project = await ProjectModel.findOneAndUpdate({ _id: params.id, ownerId: sub }, body, {
    new: true,
    runValidators: true,
  });
  return NextResponse.json({ project });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const existing = await ProjectModel.findOne({ _id: params.id, ownerId: sub });
  if (!existing) throw new ApiError(404, 'Project not found');
  if (existing.status === 'locked') {
    throw new ApiError(409, 'Project is finalised and locked — it cannot be deleted');
  }
  await ProjectModel.deleteOne({ _id: existing._id });
  return new NextResponse(null, { status: 204 });
});
