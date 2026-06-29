import { ApiError } from './http';
import type { AccessTokenPayload } from './jwt';
import { DOC_TYPES, type DocType } from './models/AiDocument';
import { ProjectModel, type ProjectDocument } from './models/Project';

export function parseDocType(raw: string): DocType {
  if (!(DOC_TYPES as readonly string[]).includes(raw)) {
    throw new ApiError(400, `docType must be one of: ${DOC_TYPES.join(', ')}`);
  }
  return raw as DocType;
}

/** admin/tech → any project; client → only their own. Throws 404 otherwise. */
export async function loadAccessibleProject(
  projectId: string,
  user: AccessTokenPayload,
): Promise<ProjectDocument> {
  const project = await ProjectModel.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  const isOwner = String(project.ownerId) === user.sub;
  if (user.role === 'admin' || user.role === 'tech' || isOwner) return project;
  throw new ApiError(404, 'Project not found');
}

/** Tech users only ever see approved documents. */
export function approvedOnlyFor(user: AccessTokenPayload): boolean {
  return user.role === 'tech';
}
