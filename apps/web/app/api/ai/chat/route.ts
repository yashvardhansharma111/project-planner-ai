import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { handler, parseBody } from '@/server/http';
import { chatSchema } from '@/server/schemas';
import { chatReply } from '@/server/services/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  requireAuth(req);
  const { messages } = await parseBody(req, chatSchema);
  const reply = await chatReply(messages);
  return NextResponse.json({ reply });
});
