import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { handler, parseBody } from '@/server/http';
import { ProjectModel } from '@/server/models/Project';
import { createProjectSchema } from '@/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const projects = await ProjectModel.find({ ownerId: sub }).sort({ createdAt: -1 });
  return NextResponse.json({ projects });
});

export const POST = handler(async (req) => {
  await connectDB();
  const { sub } = requireAuth(req);
  const body = await parseBody(req, createProjectSchema);
  const project = await ProjectModel.create({ ...body, ownerId: sub });
  return NextResponse.json({ project }, { status: 201 });
});
