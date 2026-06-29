import { requireAuth } from '@/server/auth';
import { connectDB } from '@/server/db';
import { approvedOnlyFor, loadAccessibleProject, parseDocType } from '@/server/documents';
import { ApiError, handler } from '@/server/http';
import { AiDocumentModel } from '@/server/models/AiDocument';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string; docType: string } };

/** GET /api/documents/:projectId/:docType/download — download as Markdown. */
export const GET = handler<Ctx>(async (req, { params }) => {
  await connectDB();
  const user = requireAuth(req);
  const project = await loadAccessibleProject(params.id, user);
  const docType = parseDocType(params.docType);

  const document = await AiDocumentModel.findOne({ projectId: params.id, docType });
  if (!document || (approvedOnlyFor(user) && !document.isApproved)) {
    throw new ApiError(404, 'Document not found');
  }

  const body =
    typeof document.content === 'string'
      ? document.content
      : JSON.stringify(document.content, null, 2);
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-${docType}.md"`,
    },
  });
});
