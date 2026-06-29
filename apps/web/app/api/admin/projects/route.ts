import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { handler } from '@/server/http';
import { ProjectModel } from '@/server/models/Project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  await connectDB();
  requireRole(req, 'admin');
  const projects = await ProjectModel.find()
    .populate('ownerId', 'fullName email')
    .sort({ createdAt: -1 });
  return NextResponse.json({ projects });
});
