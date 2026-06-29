import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { handler, parseBody } from '@/server/http';
import { QuestionModel } from '@/server/models/Question';
import { questionBodySchema } from '@/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  await connectDB();
  requireRole(req, 'admin');
  const questions = await QuestionModel.find();
  const sorted = [...questions]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((q) => q.toJSON());
  return NextResponse.json({ questions: sorted });
});

export const POST = handler(async (req) => {
  await connectDB();
  requireRole(req, 'admin');
  const body = await parseBody(req, questionBodySchema);
  const question = await QuestionModel.create(body);
  return NextResponse.json({ question: question.toJSON() }, { status: 201 });
});
