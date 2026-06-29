import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler } from '@/server/http';
import { AiDocumentModel } from '@/server/models/AiDocument';
import { MilestoneModel } from '@/server/models/Milestone';
import { ProjectModel } from '@/server/models/Project';
import { TaskModel } from '@/server/models/Task';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/admin/users/:id — remove a user + everything they own. */
export const DELETE = handler<{ params: { id: string } }>(async (req, { params }) => {
  await connectDB();
  const me = requireRole(req, 'admin');

  const target = await UserModel.findById(params.id);
  if (!target) throw new ApiError(404, 'User not found');
  if (me.sub === target.id) throw new ApiError(400, 'You cannot delete your own account');
  if (target.role === 'admin') {
    const adminCount = await UserModel.countDocuments({ role: 'admin' });
    if (adminCount <= 1) throw new ApiError(400, 'Cannot delete the last remaining admin');
  }

  const projects = await ProjectModel.find({ ownerId: target._id }).select('_id');
  const projectIds = projects.map((p) => p._id);
  if (projectIds.length) {
    await Promise.all([
      AiDocumentModel.deleteMany({ projectId: { $in: projectIds } }),
      TaskModel.deleteMany({ projectId: { $in: projectIds } }),
      MilestoneModel.deleteMany({ projectId: { $in: projectIds } }),
      ProjectModel.deleteMany({ _id: { $in: projectIds } }),
    ]);
  }
  await UserModel.deleteOne({ _id: target._id });

  return new NextResponse(null, { status: 204 });
});
