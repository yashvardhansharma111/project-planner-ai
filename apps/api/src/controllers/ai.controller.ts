import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../middleware/error.middleware';
import { AiDocumentModel } from '../models/AiDocument';
import { ProjectModel } from '../models/Project';
import {
  chatReply,
  chatReplyStream,
  enrichAnswers,
  extractProject,
  generatePrdTrd,
  suggestFeatures,
} from '../services/ai.service';
import type { ChatResult } from '../services/groq.service';

// Conversation payload shared by the chat + extract endpoints.
export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
});

/** Upsert a generated doc, bumping its version and resetting approval. */
async function saveGeneratedDoc(
  projectId: string,
  docType: 'prd' | 'trd',
  result: ChatResult,
) {
  return AiDocumentModel.findOneAndUpdate(
    { projectId, docType },
    {
      $set: {
        content: result.content,
        generatedBy: env.GROQ_MODEL,
        tokensUsed: result.tokensUsed,
        isApproved: false, // a fresh generation needs re-approval
      },
      $inc: { version: 1 },
    },
    { upsert: true, new: true },
  );
}

/** Optional body for generate: a confirmed feature checklist to enforce. */
export const generateSchema = z.object({
  features: z.array(z.string().min(1).max(120)).max(30).optional(),
});

/** Load a project and assert the caller may generate its documents. */
async function projectForGeneration(req: Request) {
  const project = await ProjectModel.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const { role, sub } = req.user!;
  const isOwner = String(project.ownerId) === sub;
  if (role !== 'admin' && !isOwner) {
    throw new ApiError(403, 'Only the project owner or an admin can generate documents');
  }
  return project;
}

/**
 * POST /api/ai/checklist/:projectId
 * Suggests an editable feature checklist for the project before generating.
 */
export async function suggestChecklist(req: Request, res: Response): Promise<void> {
  const project = await projectForGeneration(req);
  const features = await suggestFeatures({
    name: project.name,
    industry: project.industry,
    description: project.description,
    budgetRange: project.budgetRange,
    targetCountries: project.targetCountries,
  });
  res.json({ features });
}

/**
 * POST /api/ai/generate/:projectId
 * Generates (or regenerates) the project's PRD + TRD via Groq and stores them.
 * Only the project owner or an admin can generate; tech is read-only.
 * An optional `features` checklist (from the pre-generation step) is enforced.
 */
export async function generateDocuments(req: Request, res: Response): Promise<void> {
  const project = await projectForGeneration(req);
  const { features } = req.body as z.infer<typeof generateSchema>;

  // Finalised projects are frozen — unlock (change status) to regenerate.
  if (project.status === 'locked') {
    throw new ApiError(409, 'Project is finalised — change its status to regenerate');
  }

  // Calls Groq (throws 503 if GROQ_API_KEY is unset). May take a few seconds.
  const { prd, trd } = await generatePrdTrd({
    name: project.name,
    industry: project.industry,
    description: project.description,
    budgetRange: project.budgetRange,
    targetCountries: project.targetCountries,
    features,
  });

  const [prdDoc, trdDoc] = await Promise.all([
    saveGeneratedDoc(project.id, 'prd', prd),
    saveGeneratedDoc(project.id, 'trd', trd),
  ]);

  res.status(201).json({
    documents: [prdDoc, trdDoc],
    tokensUsed: prd.tokensUsed + trd.tokensUsed,
  });
}

/** POST /api/ai/chat — one conversational reply (chatbot intake). */
export async function chat(req: Request, res: Response): Promise<void> {
  const { messages } = req.body as z.infer<typeof chatSchema>;
  const reply = await chatReply(messages);
  res.json({ reply });
}

/**
 * POST /api/ai/chat/stream — same reply, streamed token-by-token as plain text.
 * Not wrapped in asyncHandler: once bytes are flushed we can't switch to a JSON
 * error, so we handle failures inline (clean status if nothing was sent yet).
 */
export async function chatStream(req: Request, res: Response): Promise<void> {
  const { messages } = req.body as z.infer<typeof chatSchema>;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (e.g. nginx)

  try {
    for await (const token of chatReplyStream(messages)) {
      res.write(token);
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      const status = err instanceof ApiError ? err.statusCode : 500;
      const message = err instanceof Error ? err.message : 'Chat failed';
      res.status(status).json({ error: message });
    } else {
      res.end();
    }
  }
}

/** POST /api/ai/chat/extract — distill the conversation into a project draft. */
export async function chatExtract(req: Request, res: Response): Promise<void> {
  const { messages } = req.body as z.infer<typeof chatSchema>;
  const project = await extractProject(messages);
  res.json({ project });
}

export const enrichSchema = z.object({ text: z.string().min(1).max(8000) });

/** POST /api/ai/enrich — polish raw questionnaire answers into a clean brief. */
export async function enrich(req: Request, res: Response): Promise<void> {
  const { text } = req.body as z.infer<typeof enrichSchema>;
  const description = await enrichAnswers(text);
  res.json({ description });
}
