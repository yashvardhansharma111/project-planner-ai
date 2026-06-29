import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler } from '@/server/http';
import { ProjectModel } from '@/server/models/Project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler<{ params: { id: string } }>(async (req, { params }) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const project = await ProjectModel.findOneAndUpdate(
    { _id: params.id, ownerId: sub },
    { status: 'locked' },
    { new: true },
  );
  if (!project) throw new ApiError(404, 'Project not found');
  return NextResponse.json({ project });
});
