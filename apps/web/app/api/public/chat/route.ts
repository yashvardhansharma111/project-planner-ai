import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, handler, parseBody } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { chatReply } from '@/server/services/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GUEST_MAX_TURNS = 12;

const publicChatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
});

/** POST /api/public/chat — unauthenticated guest chat, rate-limited + capped. */
export const POST = handler(async (req) => {
  rateLimit(req, { windowMs: 10 * 60 * 1000, max: 40 });
  const { messages } = await parseBody(req, publicChatSchema);

  const userTurns = messages.filter((m) => m.role === 'user').length;
  if (userTurns > GUEST_MAX_TURNS) {
    throw new ApiError(403, 'Guest limit reached — sign in to keep going and generate documents.');
  }

  const reply = await chatReply(messages);
  return NextResponse.json({ reply });
});
