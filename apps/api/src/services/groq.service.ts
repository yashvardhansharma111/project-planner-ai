import Groq from 'groq-sdk';
import { env } from '../config/env';
import { ApiError } from '../middleware/error.middleware';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

let client: Groq | null = null;

/** Lazily construct the Groq client; 503 if no key is configured. */
function getClient(): Groq {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI is not configured — set GROQ_API_KEY in .env');
  }
  if (!client) client = new Groq({ apiKey: env.GROQ_API_KEY });
  return client;
}

export interface ChatResult {
  content: string;
  tokensUsed: number;
}

/** One non-streaming chat completion against the configured Groq model.
 *  Set opts.json to force a JSON-object response (Groq JSON mode).
 *  opts.maxTokens caps the response length (defaults to GROQ_MAX_TOKENS). */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { temperature?: number; json?: boolean; maxTokens?: number } = {},
): Promise<ChatResult> {
  const res = await getClient().chat.completions.create({
    model: env.GROQ_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? env.GROQ_MAX_TOKENS,
    temperature: opts.temperature ?? 0.4,
    ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
  });

  return {
    content: res.choices[0]?.message?.content ?? '',
    tokensUsed: res.usage?.total_tokens ?? 0,
  };
}

/**
 * Streaming chat completion — yields content deltas as they arrive.
 * The initial create() is awaited first, so a misconfiguration (no API key)
 * throws before any token is emitted, letting callers send a clean error.
 */
export async function* chatCompletionStream(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): AsyncGenerator<string> {
  const stream = await getClient().chat.completions.create({
    model: env.GROQ_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? env.GROQ_MAX_TOKENS,
    temperature: opts.temperature ?? 0.4,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export { ApiError };
