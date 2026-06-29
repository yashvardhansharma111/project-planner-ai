import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler } from '@/server/http';
import { ProjectModel } from '@/server/models/Project';
import { suggestFeatures } from '@/server/services/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = handler<{ params: { projectId: string } }>(async (req, { params }) => {
  await connectDB();
  const { role, sub } = requireAuth(req);

  const project = await ProjectModel.findById(params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  const isOwner = String(project.ownerId) === sub;
  if (role !== 'admin' && !isOwner) {
    throw new ApiError(403, 'Only the project owner or an admin can generate documents');
  }

  const features = await suggestFeatures({
    name: project.name,
    industry: project.industry,
    description: project.description,
    budgetRange: project.budgetRange,
    targetCountries: project.targetCountries,
  });
  return NextResponse.json({ features });
});
