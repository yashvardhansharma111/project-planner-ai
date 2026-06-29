import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { handler } from '@/server/http';
import { AiDocumentModel } from '@/server/models/AiDocument';
import { ProjectModel } from '@/server/models/Project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/documents — every doc the caller can access (admin all · tech approved · client own). */
export const GET = handler(async (req) => {
  await connectDB();
  const { role, sub } = requireAuth(req);

  let filter: Record<string, unknown> = {};
  if (role === 'tech') {
    filter = { isApproved: true };
  } else if (role !== 'admin') {
    const owned = await ProjectModel.find({ ownerId: sub }).select('_id');
    filter = { projectId: { $in: owned.map((p) => p._id) } };
  }
  const documents = await AiDocumentModel.find(filter)
    .populate('projectId', 'name status')
    .sort({ updatedAt: -1 });
  return NextResponse.json({ documents });
});
