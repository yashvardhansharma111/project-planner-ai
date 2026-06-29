import { requireAuth } from '@/server/auth';
import { env } from '@/server/env';
import { ApiError, handler, parseBody } from '@/server/http';
import { chatSchema } from '@/server/schemas';
import { chatReplyStream } from '@/server/services/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/ai/chat/stream — streamed assistant reply (plain text chunks). */
export const POST = handler(async (req) => {
  requireAuth(req);
  if (!env.GROQ_API_KEY) throw new ApiError(503, 'AI is not configured');
  const { messages } = await parseBody(req, chatSchema);

  const gen = chatReplyStream(messages);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value));
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
});
