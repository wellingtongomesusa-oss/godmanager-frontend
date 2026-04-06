'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useLanguage } from '@/contexts/language-context';
import { uploadCSV, uploadPDF, validateFileType, formatFileSize } from '@/services/upload.service';
import { cn } from '@/lib/utils';

type UploadMode = 'csv' | 'pdf' | null;

export function UploadBar() {
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<UploadMode>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ name: string; size: string } | null>(null);

  const openModal = useCallback((m: 'csv' | 'pdf') => {
    setMode(m);
    setModalOpen(true);
    setFile(null);
    setPreview(null);
    setStatus('idle');
    setMessage('');
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setMode(null);
    setFile(null);
    setPreview(null);
    setStatus('idle');
  }, []);

  const validateAndSetFile = useCallback(
    (f: File | null) => {
      if (!f) {
        setFile(null);
        setPreview(null);
        setStatus('idle');
        return;
      }
      if (!mode) return;
      const valid = validateFileType(f, mode);
      if (!valid) {
        setFile(null);
        setPreview(null);
        setStatus('error');
        setMessage(mode === 'csv' ? t('upload.invalidCsv') : t('upload.invalidPdf'));
        return;
      }
      setFile(f);
      setPreview({ name: f.name, size: formatFileSize(f.size) });
      setStatus('idle');
      setMessage('');
    },
    [mode, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      validateAndSetFile(f ?? null);
    },
    [validateAndSetFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      validateAndSetFile(f ?? null);
      e.target.value = '';
    },
    [validateAndSetFile]
  );

  const handleUpload = useCallback(async () => {
    if (!file || !mode) return;
    setStatus('uploading');
    setMessage('');
    try {
      const result = mode === 'csv' ? await uploadCSV(file) : await uploadPDF(file);
      if (result.success) {
        setStatus('success');
        setMessage(result.message);
        setPreview({ name: result.fileName, size: formatFileSize(result.fileSize) });
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    } catch {
      setStatus('error');
      setMessage(t('upload.error'));
    }
  }, [file, mode, t]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-secondary-200 bg-white px-4 py-3 shadow-sm sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => openModal('csv')}>
            {t('upload.uploadCsv')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openModal('pdf')}>
            {t('upload.uploadPdf')}
          </Button>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={mode === 'csv' ? t('upload.uploadCsv') : t('upload.uploadPdf')}
        size="md"
      >
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'flex min-h-[120px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors',
              dragging ? 'border-primary-400 bg-primary-50' : 'border-secondary-300 bg-secondary-50/50'
            )}
          >
            <p className="text-sm text-secondary-600">{t('upload.dragDrop')}</p>
            <p className="mt-1 text-xs text-secondary-500">{mode === 'csv' ? '.csv' : '.pdf'}</p>
            <label className="mt-3 cursor-pointer">
              <span className="rounded-lg bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-200">
                {t('upload.selectFile')}
              </span>
              <input
                type="file"
                accept={mode === 'csv' ? '.csv' : '.pdf'}
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </div>

          {preview && (
            <div className="flex items-center justify-between rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-2 text-sm">
              <span className="truncate text-secondary-800">{preview.name}</span>
              <span className="shrink-0 text-secondary-500">{preview.size}</span>
            </div>
          )}

          {status === 'uploading' && (
            <p className="text-sm text-primary-600">{t('upload.progress')}</p>
          )}
          {status === 'success' && (
            <p className="text-sm text-success-600">{message}</p>
          )}
          {status === 'error' && (
            <p className="text-sm text-danger-600">{message}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeModal}>
              {t('common.close')}
            </Button>
            <Button size="sm" onClick={handleUpload} disabled={!file || status === 'uploading'}>
              {status === 'uploading' ? t('upload.progress') : t('upload.upload')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
