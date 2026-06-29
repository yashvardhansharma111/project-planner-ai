import { DOC_TYPES, type DocType } from '../models/AiDocument';
import { chatCompletion, chatCompletionStream, type ChatResult } from './groq.service';

const MAX_HISTORY_TURNS = 8;
const CHAT_REPLY_MAX_TOKENS = 400;

export interface ProjectRequirements {
  name: string;
  industry?: string | null;
  description?: string | null;
  budgetRange?: string | null;
  targetCountries?: string[];
  features?: string[];
}

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

const BRD_SYSTEM = `You are a senior business analyst. Write a Business Requirements
Document (BRD) in GitHub-flavored Markdown for the project described by the user.
Use these sections, in order:
# Business Requirements Document — <project name>
## 1. Executive Summary
## 2. Business Objectives
## 3. Stakeholders
## 4. Scope (In / Out)
## 5. Functional Requirements  (numbered)
## 6. Non-Functional Requirements
## 7. Assumptions & Constraints
## 8. Success Criteria & KPIs
Focus on business value and outcomes, not implementation. Be concise and realistic.`;

const SRS_SYSTEM = `You are a senior systems analyst. Write a Software Requirements
Specification (SRS), IEEE-830 style, in GitHub-flavored Markdown for the project.
Use these sections, in order:
# Software Requirements Specification — <project name>
## 1. Introduction (Purpose, Scope, Definitions)
## 2. Overall Description
## 3. Functional Requirements
Use identifiers like FR-1, FR-2 with clear, testable statements.
## 4. External Interface Requirements (UI, APIs, Hardware)
## 5. Non-Functional Requirements (Performance, Security, Reliability, Usability)
## 6. Acceptance Criteria
Be precise and unambiguous.`;

const API_DOCS_SYSTEM = `You are a senior backend engineer. Write REST API
documentation in GitHub-flavored Markdown for the project described by the user.
Use these sections:
# API Documentation — <project name>
## Overview (base URL, format)
## Authentication
## Endpoints
For each resource, document the endpoints as a Markdown table with columns:
Method | Path | Description | Auth. Then show 2-3 key endpoints with a JSON request
and JSON response example in fenced \`\`\`json code blocks.
## Error Handling (status codes table)
Infer sensible resources/endpoints from the requirements. Be realistic.`;

const DB_SCHEMA_SYSTEM = `You are a senior data engineer. Write the database schema
in GitHub-flavored Markdown for the project described by the user.
Use these sections:
# Database Schema — <project name>
## Overview (database type and rationale)
## Entities
For each table/collection: a heading, a one-line purpose, and a Markdown table of
columns/fields (name, type, constraints/notes).
## Relationships (describe foreign keys / references)
## Entity Relationship Diagram
Provide an ERD inside a fenced \`\`\`mermaid code block using \`erDiagram\` syntax.
## Indexes
Choose a database appropriate to the requirements. Be concrete.`;

export const DOC_META: Record<DocType, { label: string; system: string }> = {
  prd: { label: 'PRD', system: PRD_SYSTEM },
  trd: { label: 'TRD', system: TRD_SYSTEM },
  brd: { label: 'BRD', system: BRD_SYSTEM },
  srs: { label: 'SRS', system: SRS_SYSTEM },
  api_docs: { label: 'API Docs', system: API_DOCS_SYSTEM },
  db_schema: { label: 'DB Schema', system: DB_SCHEMA_SYSTEM },
};

export interface GeneratedDoc {
  docType: DocType;
  result: ChatResult;
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const CHAT_SYSTEM = `You are a friendly product strategist helping a user scope a
new software project. Ask focused, one-at-a-time questions to uncover: the core
problem, target users, key features, industry, platform (web / mobile / both),
the user's preferred tech stack (languages, frameworks, database, hosting — and
note "no preference" if they're unsure), and a rough budget. Always include a
question about their preferred or required tech stack before wrapping up. Keep
replies short and conversational. Once you have a clear picture, tell the user
they can click "Create project" to turn the conversation into a project brief.`;

function recentTurns(history: ChatTurn[]): ChatTurn[] {
  return history.slice(-MAX_HISTORY_TURNS);
}

export async function chatReply(history: ChatTurn[]): Promise<string> {
  const { content } = await chatCompletion(
    [{ role: 'system', content: CHAT_SYSTEM }, ...recentTurns(history)],
    { temperature: 0.6, maxTokens: CHAT_REPLY_MAX_TOKENS },
  );
  return content;
}

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
    /* defaults */
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

export async function generateDoc(
  docType: DocType,
  project: ProjectRequirements,
): Promise<ChatResult> {
  return chatCompletion([
    { role: 'system', content: DOC_META[docType].system },
    { role: 'user', content: requirementsBrief(project) },
  ]);
}

export async function generateDocs(
  project: ProjectRequirements,
  docTypes: DocType[],
): Promise<GeneratedDoc[]> {
  const results = await Promise.all(docTypes.map((docType) => generateDoc(docType, project)));
  return docTypes.map((docType, i) => ({ docType, result: results[i]! }));
}

export { DOC_TYPES };
