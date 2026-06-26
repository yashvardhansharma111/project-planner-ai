import { chatCompletion, chatCompletionStream, type ChatResult } from './groq.service';

/** Keep the conversation context small: only the most recent turns matter for
 *  the next reply, and trimming cuts both latency and token cost. */
const MAX_HISTORY_TURNS = 8;
/** Chat replies are short — no need for the full document token budget. */
const CHAT_REPLY_MAX_TOKENS = 400;

/** The shape of project fields we feed into the prompt (intake-agnostic). */
export interface ProjectRequirements {
  name: string;
  industry?: string | null;
  description?: string | null;
  budgetRange?: string | null;
  targetCountries?: string[];
  /** Confirmed feature checklist (from the pre-generation step). */
  features?: string[];
}

/** Compile project fields into a compact requirements brief for the LLM. */
function requirementsBrief(p: ProjectRequirements): string {
  const lines = [
    `Project name: ${p.name}`,
    p.industry ? `Industry: ${p.industry}` : null,
    p.description ? `Description: ${p.description}` : null,
    p.budgetRange ? `Budget range: ${p.budgetRange}` : null,
    p.targetCountries?.length ? `Target countries: ${p.targetCountries.join(', ')}` : null,
    p.features?.length
      ? `Required features (must all be covered):\n${p.features.map((f) => `- ${f}`).join('\n')}`
      : null,
  ].filter(Boolean);
  return lines.join('\n');
}

const PRD_SYSTEM = `You are a senior product manager. Write a clear, professional
Product Requirements Document (PRD) in GitHub-flavored Markdown for the project
described by the user. Use these sections, in order:
# Product Requirements Document — <project name>
## 1. Overview
## 2. Goals
## 3. Target Users
## 4. Key Features  (numbered list)
## 5. Out of Scope
## 6. Success Metrics
Be concise, specific, and realistic. Do not invent a different project.`;

const TRD_SYSTEM = `You are a senior software architect. Write a Technical
Requirements Document (TRD) in GitHub-flavored Markdown for the project described
by the user. Use these sections, in order:
# Technical Requirements Document — <project name>
## 1. Architecture
## 2. Tech Stack
## 3. Modules
Break the system into its major modules. For each: a bold module name, a one-line
responsibility, and a short bullet list of its key components/services.
## 4. Folder Structure
Provide a realistic project folder tree that reflects the chosen tech stack and the
modules above. Render it inside a fenced code block using a tree layout, e.g.:
\`\`\`
project/
├─ apps/
│  ├─ web/
│  └─ api/
└─ packages/
\`\`\`
## 5. Data Model
## 6. API Design
## 7. Security
## 8. Scalability & Risks
Be concise and pragmatic. Prefer widely-used, cost-effective technologies.`;

export interface GeneratedDocs {
  prd: ChatResult;
  trd: ChatResult;
}

// ── Chatbot intake ───────────────────────────────────────────────────────────
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const CHAT_SYSTEM = `You are a friendly product strategist helping a user scope a
new software project. Ask focused, one-at-a-time questions to uncover: the core
problem, target users, key features, industry, platform, and rough budget. Keep
replies short and conversational. Once you have a clear picture, tell the user
they can click "Create project" to turn the conversation into a project brief.`;

/** Keep only the most recent turns to send to the model. */
function recentTurns(history: ChatTurn[]): ChatTurn[] {
  return history.slice(-MAX_HISTORY_TURNS);
}

/** A single conversational reply from the assistant (non-streaming). */
export async function chatReply(history: ChatTurn[]): Promise<string> {
  const { content } = await chatCompletion(
    [{ role: 'system', content: CHAT_SYSTEM }, ...recentTurns(history)],
    { temperature: 0.6, maxTokens: CHAT_REPLY_MAX_TOKENS },
  );
  return content;
}

/** Streaming variant of chatReply — yields the assistant reply token-by-token. */
export function chatReplyStream(history: ChatTurn[]): AsyncGenerator<string> {
  return chatCompletionStream(
    [{ role: 'system', content: CHAT_SYSTEM }, ...recentTurns(history)],
    { temperature: 0.6, maxTokens: CHAT_REPLY_MAX_TOKENS },
  );
}

export interface ProjectDraft {
  name: string;
  industry: string;
  description: string;
  budgetRange: string;
  /** 0-100 — how complete the requirements are for writing a PRD/TRD. */
  completeness: number;
}

const EXTRACT_SYSTEM = `From the conversation, produce ONLY a JSON object with
these keys: "name" (a concise project name), "industry", "description" (a thorough
paragraph synthesizing the requirements discussed), "budgetRange" (or empty string
if unknown), and "completeness" (an integer 0-100 estimating how complete the
requirements are for writing a PRD/TRD — judge whether the core problem, target
users, key features, platform, and budget are known). Do not include other text.`;

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Distill the conversation into a structured project draft (JSON mode). */
export async function extractProject(history: ChatTurn[]): Promise<ProjectDraft> {
  const { content } = await chatCompletion(
    [
      { role: 'system', content: EXTRACT_SYSTEM },
      ...recentTurns(history),
      { role: 'user', content: 'Produce the project JSON now.' },
    ],
    { json: true, temperature: 0.2, maxTokens: 800 },
  );

  let data: Partial<ProjectDraft> = {};
  try {
    data = JSON.parse(content);
  } catch {
    /* fall through to defaults */
  }
  return {
    name: data.name?.trim() || 'Untitled project',
    industry: data.industry?.trim() || '',
    description: data.description?.trim() || '',
    budgetRange: data.budgetRange?.trim() || '',
    completeness: clampScore(data.completeness),
  };
}

const ENRICH_SYSTEM = `You are a product analyst. Rewrite the user's raw
questionnaire answers into a clear, well-structured project brief suitable as
input for a PRD/TRD. Preserve every fact; do not invent details. Write 2-4 concise
paragraphs in plain prose (no markdown headings, no preamble).`;

/** Turn raw questionnaire answers into a polished, structured brief. */
export async function enrichAnswers(raw: string): Promise<string> {
  const { content } = await chatCompletion(
    [
      { role: 'system', content: ENRICH_SYSTEM },
      { role: 'user', content: raw },
    ],
    { temperature: 0.3, maxTokens: 700 },
  );
  return content.trim();
}

const CHECKLIST_SYSTEM = `You are a product manager. From the project details,
propose a concise checklist of the 6-10 most important features this product should
include. Respond ONLY with a JSON object: { "features": string[] } where each item
is a short feature name (3-7 words). No other text.`;

/** Suggest an editable feature checklist for a project (JSON mode). */
export async function suggestFeatures(project: ProjectRequirements): Promise<string[]> {
  const { content } = await chatCompletion(
    [
      { role: 'system', content: CHECKLIST_SYSTEM },
      { role: 'user', content: requirementsBrief(project) },
    ],
    { json: true, temperature: 0.3 },
  );
  try {
    const data = JSON.parse(content) as { features?: unknown };
    if (Array.isArray(data.features)) {
      return data.features
        .filter((f): f is string => typeof f === 'string')
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
  } catch {
    /* fall through */
  }
  return [];
}

/** Generate both the PRD and TRD from a project's requirements (in parallel). */
export async function generatePrdTrd(project: ProjectRequirements): Promise<GeneratedDocs> {
  const brief = requirementsBrief(project);
  const [prd, trd] = await Promise.all([
    chatCompletion([
      { role: 'system', content: PRD_SYSTEM },
      { role: 'user', content: brief },
    ]),
    chatCompletion([
      { role: 'system', content: TRD_SYSTEM },
      { role: 'user', content: brief },
    ]),
  ]);
  return { prd, trd };
}
