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

export const GET = handler<{ params: { projectId: string } }>(async (req, { params }) => {
  await connectDB();
  const { role } = requireRole(req, 'tech', 'admin');

  const project = await ProjectModel.findById(params.projectId).populate('ownerId', 'fullName email');
  if (!project) throw new ApiError(404, 'Project not found');

  const docFilter: Record<string, unknown> = { projectId: project._id };
  if (role === 'tech') docFilter.isApproved = true;

  const [documents, tasks, milestones] = await Promise.all([
    AiDocumentModel.find(docFilter).sort({ docType: 1 }),
    TaskModel.find({ projectId: project._id }).sort({ order: 1, createdAt: 1 }),
    MilestoneModel.find({ projectId: project._id }).sort({ order: 1, dueDate: 1 }),
  ]);

  return NextResponse.json({ project, documents, tasks, milestones });
});
