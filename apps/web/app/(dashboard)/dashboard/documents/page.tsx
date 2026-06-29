'use client';

import { Download, Eye, FileText } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiDownload, apiFetch } from '@/lib/api';

interface ProjectRef {
  id: string;
  name: string;
  status: string;
}
interface MyDoc {
  id: string;
  docType: 'prd' | 'trd';
  isApproved: boolean;
  version: number;
  updatedAt: string;
  projectId: ProjectRef | string;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<MyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ documents: MyDoc[] }>('/documents');
      setDocs(data.documents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(projectId: string, docType: 'prd' | 'trd') {
    try {
      await apiDownload(`/documents/${projectId}/${docType}/download`, `${docType}.md`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  return (
    <main className="px-6 py-12 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Documents</h1>
      <p className="mt-1 text-slate-600">Every PRD and TRD across your projects.</p>

      {error && (
        <div className="card mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="card mt-8 overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-16 text-slate-500">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="grid place-items-center gap-3 py-16 text-center">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No documents yet — generate some from a project.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => {
                const project = typeof d.projectId === 'object' ? d.projectId : null;
                const pid = project?.id ?? (typeof d.projectId === 'string' ? d.projectId : '');
                return (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {project ? (
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="hover:text-indigo-700 hover:underline"
                        >
                          {project.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 font-semibold uppercase text-slate-700">{d.docType}</td>
                    <td className="px-5 py-3">
                      {d.isApproved ? (
                        <span className="text-emerald-700">Approved</span>
                      ) : (
                        <span className="text-amber-700">Draft</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">v{d.version}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/documents/${pid}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Link>
                        <button
                          onClick={() => download(pid, d.docType)}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
