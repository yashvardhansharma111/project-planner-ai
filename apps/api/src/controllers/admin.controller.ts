import type { Request, Response } from 'express';
import { ProjectModel } from '../models/Project';
import { UserModel } from '../models/User';

/** Admin-only: list every user (password hash omitted). */
export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await UserModel.find().select('-passwordHash').sort({ createdAt: -1 });
  res.json({ users });
}

/** Admin-only: list every project across all owners. */
export async function listAllProjects(_req: Request, res: Response): Promise<void> {
  const projects = await ProjectModel.find().sort({ createdAt: -1 });
  res.json({ projects });
}
