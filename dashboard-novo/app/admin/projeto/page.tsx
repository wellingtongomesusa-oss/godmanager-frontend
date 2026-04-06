'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';
import {
  getClients,
  saveProject,
  updateProject,
  listProjects,
  getProject,
  calculateTotals,
  type Project,
  type ProjectInput,
  type ProjectStatus,
} from '@/services/project.service';
import {
  saveProjectFiles,
  listProjectFiles,
  deleteProjectFile,
  type ProjectFileRecord,
} from '@/services/project-files.service';
import { generateProjectReportPdf } from '@/lib/project-report-pdf';
import { formatFileSize } from '@/services/upload.service';

const STATUS_OPTIONS: ProjectStatus[] = ['Em andamento', 'Pausado', 'Concluído'];

export default function ProjetoPage() {
  const { t } = useLanguage();
  const clients = useMemo(() => getClients(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<ProjectStatus>('Em andamento');
  const [downPayment, setDownPayment] = useState(0);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [numberOfInstallments, setNumberOfInstallments] = useState(0);
  const [notes, setNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState<{ file: File; type: 'pdf' | 'image' }[]>([]);
  const [saving, setSaving] = useState(false);
  const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);

  const totalValue = useMemo(
    () => calculateTotals(downPayment, monthlyPayment, numberOfInstallments),
    [downPayment, monthlyPayment, numberOfInstallments]
  );

  const clientName = useMemo(() => clients.find((c) => c.id === clientId)?.name ?? '', [clients, clientId]);

  const loadProjects = useCallback(() => {
    setProjects(listProjects());
  }, []);

  const loadForm = useCallback((p: Project | null) => {
    if (!p) {
      setSelectedId(null);
      setName('');
      setClientId('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setStatus('Em andamento');
      setDownPayment(0);
      setMonthlyPayment(0);
      setNumberOfInstallments(0);
      setNotes('');
      setProjectFiles([]);
      return;
    }
    setSelectedId(p.id);
    setName(p.name);
    setClientId(p.clientId);
    setStartDate(p.startDate);
    setStatus(p.status);
    setDownPayment(p.downPayment);
    setMonthlyPayment(p.monthlyPayment);
    setNumberOfInstallments(p.numberOfInstallments);
    setNotes(p.notes);
    setProjectFiles(listProjectFiles(p.id));
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedId) {
      const p = getProject(selectedId);
      if (p) setProjectFiles(listProjectFiles(p.id));
    } else setProjectFiles([]);
  }, [selectedId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const input: ProjectInput = {
        name,
        clientId,
        clientName,
        startDate,
        status,
        downPayment,
        monthlyPayment,
        numberOfInstallments,
        notes,
      };
      const project = saveProject(input);
      loadProjects();
      loadForm(project);
      if (pendingFiles.length > 0) {
        const saved = await saveProjectFiles(project.id, pendingFiles);
        setProjectFiles((prev) => [...saved, ...prev]);
        setPendingFiles([]);
      }
    } finally {
      setSaving(false);
    }
  }, [name, clientId, clientName, startDate, status, downPayment, monthlyPayment, numberOfInstallments, notes, pendingFiles, loadProjects, loadForm]);

  const handleUpdate = useCallback(async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      updateProject(selectedId, {
        name,
        clientId,
        clientName,
        startDate,
        status,
        downPayment,
        monthlyPayment,
        numberOfInstallments,
        notes,
      });
      loadProjects();
      if (pendingFiles.length > 0) {
        const saved = await saveProjectFiles(selectedId, pendingFiles);
        setProjectFiles((prev) => [...saved, ...prev]);
        setPendingFiles([]);
      }
    } finally {
      setSaving(false);
    }
  }, [selectedId, name, clientId, clientName, startDate, status, downPayment, monthlyPayment, numberOfInstallments, notes, pendingFiles, loadProjects]);

  const handleGenerateReport = useCallback(() => {
    const p = selectedId ? getProject(selectedId) : null;
    if (!p) return;
    const files = listProjectFiles(p.id);
    generateProjectReportPdf(p, files);
  }, [selectedId]);

  const addFiles = useCallback((files: FileList | null, type: 'pdf' | 'image') => {
    if (!files?.length) return;
    const allowed = type === 'pdf' ? ['.pdf'] : ['.jpg', '.jpeg', '.png'];
    const toAdd = Array.from(files).filter((f) => allowed.some((ext) => f.name.toLowerCase().endsWith(ext)));
    setPendingFiles((prev) => [...prev, ...toAdd.map((file) => ({ file, type }))]);
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDeleteFile = useCallback((fileId: string) => {
    deleteProjectFile(fileId);
    setProjectFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  return (
    <div className="space-y-8">
      <div className="border-b border-secondary-200 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-secondary-900 sm:text-3xl">{t('projeto.title')}</h1>
        <p className="mt-2 text-sm text-secondary-600">{t('projeto.subtitle')}</p>
      </div>

      {/* Seleção de projeto existente */}
      {projects.length > 0 && (
        <Card className="border-secondary-200 bg-white">
          <CardContent className="pt-6">
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('projeto.selectProject')}</label>
            <select
              value={selectedId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null;
                setSelectedId(id);
                loadForm(id ? getProject(id) ?? null : null);
              }}
              className="flex h-11 w-full max-w-md rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— Novo projeto —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.clientName}</option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {/* Seção 1 — Informações Gerais */}
      <Card variant="elevated" className="bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('projeto.section1')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('projeto.projectName')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do projeto" />
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('projeto.client')}</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecione</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Input label={t('projeto.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('projeto.status')}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Em andamento">{t('projeto.statusAndamento')}</option>
                <option value="Pausado">{t('projeto.statusPausado')}</option>
                <option value="Concluído">{t('projeto.statusConcluido')}</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 2 — Estrutura Financeira */}
      <Card variant="elevated" className="bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('projeto.section2')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('projeto.downPayment')} type="number" value={downPayment || ''} onChange={(e) => setDownPayment(Number(e.target.value) || 0)} placeholder="0" />
            <Input label={t('projeto.monthlyPayment')} type="number" value={monthlyPayment || ''} onChange={(e) => setMonthlyPayment(Number(e.target.value) || 0)} placeholder="0" />
            <Input label={t('projeto.numberOfInstallments')} type="number" value={numberOfInstallments || ''} onChange={(e) => setNumberOfInstallments(Number(e.target.value) || 0)} placeholder="0" />
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('projeto.totalValue')}</label>
              <p className="rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3 text-lg font-semibold text-secondary-900">{formatCurrency(totalValue, 'BRL')}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('projeto.notes')}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Notas..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3 — Upload de Arquivos */}
      <Card variant="elevated" className="bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('projeto.section3')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('projeto.uploadPdf')}</label>
              <input
                type="file"
                accept=".pdf"
                multiple
                className="text-sm text-secondary-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700"
                onChange={(e) => addFiles(e.target.files, 'pdf')}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('projeto.uploadImage')}</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                multiple
                className="text-sm text-secondary-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700"
                onChange={(e) => addFiles(e.target.files, 'image')}
              />
            </div>
          </div>
          {pendingFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary-700">Preview — {t('projeto.removeFile')}</p>
              <ul className="space-y-2">
                {pendingFiles.map((item, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-2 text-sm">
                    <span className="truncate text-secondary-800">{item.file.name}</span>
                    <span className="shrink-0 text-secondary-500">{formatFileSize(item.file.size)}</span>
                    <Button variant="ghost" size="sm" onClick={() => removePendingFile(i)}>{t('projeto.removeFile')}</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 4 — Histórico */}
      <Card variant="elevated" className="bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('projeto.section4')}</CardTitle>
        </CardHeader>
        <CardContent>
          {projectFiles.length === 0 ? (
            <p className="text-sm text-secondary-500">Nenhum arquivo anexado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200 text-left text-secondary-600">
                    <th className="pb-2 pr-4 font-medium">{t('projeto.historyDate')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('projeto.historyType')}</th>
                    <th className="pb-2 pr-4 font-medium">Arquivo</th>
                    <th className="pb-2 font-medium">{t('table.acoes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {projectFiles.map((f) => (
                    <tr key={f.id} className="border-b border-secondary-100">
                      <td className="py-2 pr-4">{f.uploadedAt.slice(0, 10)}</td>
                      <td className="py-2 pr-4">{f.type}</td>
                      <td className="py-2 pr-4">{f.fileName} ({formatFileSize(f.fileSize)})</td>
                      <td className="py-2">
                        <Button variant="ghost" size="sm" className="mr-2">Download</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteFile(f.id)} className="text-danger-600">{t('projeto.delete')}</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 5 — Ações */}
      <Card className="border-secondary-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('projeto.section5')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving}>{saving ? t('upload.progress') : t('projeto.save')}</Button>
          <Button variant="outline" onClick={handleUpdate} disabled={!selectedId || saving}>{t('projeto.update')}</Button>
          <Button variant="outline" onClick={handleGenerateReport} disabled={!selectedId}>{t('projeto.generateReport')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
