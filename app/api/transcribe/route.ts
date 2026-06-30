import { NextResponse } from 'next/server';
import { ApiError, handler } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { transcribeAudio } from '@/server/services/groq.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024; // ~20MB — plenty for short dictation clips.

/** POST /api/transcribe — voice-to-text. Accepts an `audio` file (multipart). */
export const POST = handler(async (req) => {
  rateLimit(req, { windowMs: 10 * 60 * 1000, max: 60 });

  const form = await req.formData();
  const file = form.get('audio');
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(400, 'No audio was provided');
  }
  if (file.size > MAX_BYTES) {
    throw new ApiError(413, 'Recording is too long — keep it under ~20MB');
  }

  const text = await transcribeAudio(file);
  return NextResponse.json({ text });
});
