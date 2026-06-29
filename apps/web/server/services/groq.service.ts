import Groq from 'groq-sdk';
import { env } from '../env';
import { ApiError } from '../http';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

let client: Groq | null = null;

function getClient(): Groq {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI is not configured — set GROQ_API_KEY');
  }
  if (!client) client = new Groq({ apiKey: env.GROQ_API_KEY });
  return client;
}

export interface ChatResult {
  content: string;
  tokensUsed: number;
}

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
