import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error.middleware';
import { QuestionModel } from '../models/Question';

// ── Validation ───────────────────────────────────────────────────────────────
export const questionBodySchema = z.object({
  industry: z.string().min(1).max(80),
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z0-9_-]+$/, 'key may only contain letters, numbers, - and _'),
  label: z.string().min(1).max(300),
  type: z.enum(['text', 'textarea', 'select', 'multiselect']).default('text'),
  options: z.array(z.string().min(1)).default([]),
  placeholder: z.string().max(200).default(''),
  required: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  dependsOnKey: z.string().max(60).nullable().optional(),
  dependsOnValue: z.string().max(200).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateQuestionSchema = questionBodySchema.partial();

/** Sort questions for stable, ordered rendering. */
function byOrder(a: { order: number; label: string }, b: { order: number; label: string }): number {
  return a.order - b.order || a.label.localeCompare(b.label);
}

// ── Public (any authenticated user) ──────────────────────────────────────────
/** GET /api/questions — active questions grouped by industry, for the intake form. */
export async function listPublicQuestions(_req: Request, res: Response): Promise<void> {
  const questions = await QuestionModel.find({ isActive: true });
  const sorted = [...questions].sort(byOrder);

  const byIndustry: Record<string, unknown[]> = {};
  for (const q of sorted) {
    (byIndustry[q.industry] ??= []).push(q.toJSON());
  }
  res.json({ industries: Object.keys(byIndustry).sort(), byIndustry });
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────
/** GET /api/admin/questions — every question (active + inactive). */
export async function listQuestions(_req: Request, res: Response): Promise<void> {
  const questions = await QuestionModel.find();
  res.json({ questions: [...questions].sort(byOrder).map((q) => q.toJSON()) });
}

/** POST /api/admin/questions */
export async function createQuestion(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof questionBodySchema>;
  const question = await QuestionModel.create(body);
  res.status(201).json({ question: question.toJSON() });
}

/** PATCH /api/admin/questions/:id */
export async function updateQuestion(req: Request, res: Response): Promise<void> {
  const question = await QuestionModel.findByIdAndUpdate(
    req.params.id,
    req.body as Partial<z.infer<typeof questionBodySchema>>,
    { new: true, runValidators: true },
  );
  if (!question) throw new ApiError(404, 'Question not found');
  res.json({ question: question.toJSON() });
}

/** DELETE /api/admin/questions/:id */
export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const result = await QuestionModel.findByIdAndDelete(req.params.id);
  if (!result) throw new ApiError(404, 'Question not found');
  res.status(204).send();
}
