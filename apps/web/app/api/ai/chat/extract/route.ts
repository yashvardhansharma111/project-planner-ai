import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { handler, parseBody } from '@/server/http';
import { chatSchema } from '@/server/schemas';
import { extractProject } from '@/server/services/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  requireAuth(req);
  const { messages } = await parseBody(req, chatSchema);
  const project = await extractProject(messages);
  return NextResponse.json({ project });
});
