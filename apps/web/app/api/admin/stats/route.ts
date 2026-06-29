import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { handler } from '@/server/http';
import { AiDocumentModel } from '@/server/models/AiDocument';
import { ProjectModel } from '@/server/models/Project';
import { UserModel } from '@/server/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function budgetMidpoint(range?: string | null): number {
  if (!range) return 0;
  const nums = (range.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return 0;
  if (range.includes('+')) return nums[0] * 1000 * 1.5;
  if (nums.length >= 2) return ((nums[0] + nums[1]) / 2) * 1000;
  return nums[0] * 1000;
}

export const GET = handler(async (req) => {
  await connectDB();
  requireRole(req, 'admin');

  const [userAgg, projectDocs, docTotal, docApproved] = await Promise.all([
    UserModel.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ProjectModel.find().select('status industry budgetRange createdAt').lean(),
    AiDocumentModel.countDocuments(),
    AiDocumentModel.countDocuments({ isApproved: true }),
  ]);

  const users: Record<string, number> = { total: 0, client: 0, admin: 0, tech: 0 };
  for (const r of userAgg) {
    users[r._id as string] = r.count as number;
    users.total += r.count as number;
  }

  const projects: Record<string, number> = {
    total: projectDocs.length,
    draft: 0,
    in_review: 0,
    approved: 0,
    locked: 0,
    archived: 0,
  };

  let estimatedTotal = 0;
  const byIndustry = new Map<string, number>();

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString('en', { month: 'short' }),
      value: 0,
    };
  });
  const monthIdx = new Map(months.map((m, i) => [m.key, i]));

  for (const p of projectDocs) {
    projects[p.status as string] = (projects[p.status as string] ?? 0) + 1;
    const value = budgetMidpoint(p.budgetRange);
    estimatedTotal += value;
    const industry = p.industry || 'Other';
    byIndustry.set(industry, (byIndustry.get(industry) ?? 0) + value);
    const d = new Date(p.createdAt as unknown as string);
    const i = monthIdx.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i !== undefined) months[i].value += 1;
  }

  return NextResponse.json({
    users,
    projects,
    documents: { total: docTotal, approved: docApproved },
    revenue: {
      estimatedTotal,
      byIndustry: [...byIndustry]
        .map(([name, value]) => ({ name, value }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value),
    },
    projectsByMonth: months.map(({ label, value }) => ({ name: label, value })),
  });
});
