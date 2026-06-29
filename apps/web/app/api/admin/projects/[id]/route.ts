import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler } from '@/server/http';
import { AiDocumentModel } from '@/server/models/AiDocument';
import { MilestoneModel } from '@/server/models/Milestone';
import { ProjectModel } from '@/server/models/Project';
import { TaskModel } from '@/server/models/Task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** GET /api/admin/projects/:id — project (owner populated) + its documents. */
export const GET = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'admin');
  const project = await ProjectModel.findById(params.id).populate('ownerId', 'fullName email');
  if (!project) throw new ApiError(404, 'Project not found');
  const documents = await AiDocumentModel.find({ projectId: project.id }).sort({ docType: 1 });
  return NextResponse.json({ project, documents });
});

/** DELETE /api/admin/projects/:id — delete a project + its docs/tasks/milestones. */
export const DELETE = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'admin');
  const project = await ProjectModel.findById(params.id);
  if (!project) throw new ApiError(404, 'Project not found');

  await Promise.all([
    AiDocumentModel.deleteMany({ projectId: project._id }),
    TaskModel.deleteMany({ projectId: project._id }),
    MilestoneModel.deleteMany({ projectId: project._id }),
  ]);
  await ProjectModel.deleteOne({ _id: project._id });
  return new NextResponse(null, { status: 204 });
});
