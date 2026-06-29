import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, handler, parseBody } from '@/server/http';
import { QuestionModel } from '@/server/models/Question';
import { updateQuestionSchema } from '@/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export const PATCH = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'admin');
  const body = await parseBody(req, updateQuestionSchema);
  const question = await QuestionModel.findByIdAndUpdate(params.id, body, {
    new: true,
    runValidators: true,
  });
  if (!question) throw new ApiError(404, 'Question not found');
  return NextResponse.json({ question: question.toJSON() });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  requireRole(req, 'admin');
  const result = await QuestionModel.findByIdAndDelete(params.id);
  if (!result) throw new ApiError(404, 'Question not found');
  return new NextResponse(null, { status: 204 });
});
