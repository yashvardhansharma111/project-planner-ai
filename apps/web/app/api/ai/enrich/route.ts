import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/server/auth';
import { handler, parseBody } from '@/server/http';
import { enrichAnswers } from '@/server/services/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const enrichSchema = z.object({ text: z.string().min(1).max(8000) });

export const POST = handler(async (req) => {
  requireAuth(req);
  const { text } = await parseBody(req, enrichSchema);
  const description = await enrichAnswers(text);
  return NextResponse.json({ description });
});
