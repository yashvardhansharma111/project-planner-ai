import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler } from '@/server/http';
import { AiDocumentModel } from '@/server/models/AiDocument';
import { ProjectModel } from '@/server/models/Project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/documents/:documentId/approve — client/admin sign-off. */
export const PATCH = handler<{ params: { id: string } }>(async (req, { params }) => {
  await connectDB();
  const { role, sub } = requireAuth(req);

  const document = await AiDocumentModel.findById(params.id);
  if (!document) throw new ApiError(404, 'Document not found');
  const project = await ProjectModel.findById(document.projectId);
  if (!project) throw new ApiError(404, 'Document not found');

  const isOwner = String(project.ownerId) === sub;
  if (role !== 'admin' && !isOwner) {
    throw new ApiError(403, 'Only the project owner or an admin can approve documents');
  }

  document.isApproved = true;
  await document.save();
  return NextResponse.json({ document });
});
