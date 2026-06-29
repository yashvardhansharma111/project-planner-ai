import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { approvedOnlyFor, loadAccessibleProject } from '@/server/documents';
import { ApiError, handler, parseBody } from '@/server/http';
import { AiDocumentModel } from '@/server/models/AiDocument';
import { ProjectModel } from '@/server/models/Project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** GET /api/documents/:projectId — list a project's documents. */
export const GET = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  const user = requireAuth(req);
  await loadAccessibleProject(params.id, user);

  const filter: Record<string, unknown> = { projectId: params.id };
  if (approvedOnlyFor(user)) filter.isApproved = true;
  const documents = await AiDocumentModel.find(filter).sort({ docType: 1 });
  return NextResponse.json({ documents });
});

const updateDocumentSchema = z.object({ content: z.string().min(1, 'content cannot be empty') });

/** PATCH /api/documents/:documentId — edit a document (owner/admin; not when locked). */
export const PATCH = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  const { role, sub } = requireAuth(req);
  const { content } = await parseBody(req, updateDocumentSchema);

  const document = await AiDocumentModel.findById(params.id);
  if (!document) throw new ApiError(404, 'Document not found');
  const project = await ProjectModel.findById(document.projectId);
  if (!project) throw new ApiError(404, 'Document not found');

  const isOwner = String(project.ownerId) === sub;
  if (role !== 'admin' && !isOwner) {
    throw new ApiError(403, 'Only the project owner or an admin can edit documents');
  }
  if (project.status === 'locked' && role !== 'admin') {
    throw new ApiError(409, 'Project is finalised and locked — documents cannot be edited');
  }

  document.content = content;
  document.isApproved = false;
  await document.save();
  return NextResponse.json({ document });
});
