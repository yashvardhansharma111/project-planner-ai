import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { handler } from '@/server/http';
import { COMMON_INDUSTRY, QuestionModel } from '@/server/models/Question';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/questions — active questions grouped by industry (+ common set). */
export const GET = handler(async (req) => {
  await connectDB();
  requireAuth(req);

  const questions = await QuestionModel.find({ isActive: true });
  const sorted = [...questions].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  const common: unknown[] = [];
  const byIndustry: Record<string, unknown[]> = {};
  for (const q of sorted) {
    if (q.industry === COMMON_INDUSTRY) common.push(q.toJSON());
    else (byIndustry[q.industry] ??= []).push(q.toJSON());
  }
  return NextResponse.json({ industries: Object.keys(byIndustry).sort(), byIndustry, common });
});
