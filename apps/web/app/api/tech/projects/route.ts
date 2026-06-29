import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { handler } from '@/server/http';
import { ProjectModel } from '@/server/models/Project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVIEW_STATUSES = ['approved', 'locked'];

export const GET = handler(async (req) => {
  await connectDB();
  requireRole(req, 'tech', 'admin');
  const projects = await ProjectModel.find({ status: { $in: REVIEW_STATUSES } })
    .populate('ownerId', 'fullName email')
    .sort({ updatedAt: -1 });
  return NextResponse.json({ projects });
});
