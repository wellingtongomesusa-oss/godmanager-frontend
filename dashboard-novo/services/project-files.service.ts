/**
 * Project Files Service – dashboard-novo
 * Arquivos de projeto (PDF, JPEG/PNG): salvar, listar, excluir. Mock em memória.
 */

export interface ProjectFileRecord {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  type: 'pdf' | 'image';
  uploadedAt: string;
  /** Mock: base64 ou blob URL; em produção seria URL do storage. */
  blobUrl?: string;
}

const store: ProjectFileRecord[] = [];

function generateId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Salva arquivos associados a um projeto (mock: armazena metadados em memória).
 */
export async function saveProjectFiles(
  projectId: string,
  files: { file: File; type: 'pdf' | 'image' }[]
): Promise<ProjectFileRecord[]> {
  const created: ProjectFileRecord[] = [];
  const now = new Date().toISOString();
  for (const { file, type } of files) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const mime = type === 'pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : 'image/jpeg');
    const record: ProjectFileRecord = {
      id: generateId(),
      projectId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: mime,
      type,
      uploadedAt: now,
    };
    store.push(record);
    created.push(record);
  }
  return created;
}

/**
 * Lista arquivos de um projeto.
 */
export function listProjectFiles(projectId: string): ProjectFileRecord[] {
  return store.filter((f) => f.projectId === projectId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/**
 * Remove um arquivo (mock).
 */
export function deleteProjectFile(fileId: string): boolean {
  const idx = store.findIndex((f) => f.id === fileId);
  if (idx < 0) return false;
  store.splice(idx, 1);
  return true;
}

/**
 * Retorna um registro por ID (para download simulado).
 */
export function getProjectFile(fileId: string): ProjectFileRecord | null {
  return store.find((f) => f.id === fileId) ?? null;
}
