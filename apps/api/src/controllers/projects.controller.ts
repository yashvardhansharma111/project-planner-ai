import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error.middleware';
import { ProjectModel } from '../models/Project';

// Mirrors the `projects` collection from the architecture doc (subset for now).
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().optional(),
  description: z.string().optional(),
  budgetRange: z.string().optional(),
  targetCountries: z.array(z.string()).default([]),
  status: z
    .enum(['draft', 'in_review', 'approved', 'locked', 'archived'])
    .default('draft'),
});

export const updateProjectSchema = createProjectSchema.partial();

type ProjectInput = z.infer<typeof createProjectSchema>;

export async function listProjects(req: Request, res: Response): Promise<void> {
  const projects = await ProjectModel.find({ ownerId: req.user!.sub }).sort({
    createdAt: -1,
  });
  res.json({ projects });
}

export async function getProject(req: Request, res: Response): Promise<void> {
  const project = await ProjectModel.findOne({
    _id: req.params.id,
    ownerId: req.user!.sub,
  });
  // 404 (not 403) for someone else's project — don't reveal it exists.
  if (!project) throw new ApiError(404, 'Project not found');
  res.json({ project });
}

export async function createProject(req: Request, res: Response): Promise<void> {
  const project = await ProjectModel.create({
    ...(req.body as ProjectInput),
    ownerId: req.user!.sub,
  });
  res.status(201).json({ project });
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  const project = await ProjectModel.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user!.sub },
    req.body as Partial<ProjectInput>,
    { new: true, runValidators: true },
  );
  if (!project) throw new ApiError(404, 'Project not found');
  res.json({ project });
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  const result = await ProjectModel.findOneAndDelete({
    _id: req.params.id,
    ownerId: req.user!.sub,
  });
  if (!result) throw new ApiError(404, 'Project not found');
  res.status(204).send();
}
