import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { getR2Client, getR2Bucket } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { ZipArchive } from 'archiver';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pm/expenses/export-zip?clientId=&month=YYYY-MM
 * Baixa um ZIP com TODAS as despesas (fotos + vídeos + descrição), organizado por CASA → Work Order.
 * Cada mídia sabe a casa (JobPhoto.jobId → PmExpense.id → Property). Streaming (não estoura memória).
 * Estrutura:
 *   _INDICE.csv                          (planilha de tudo)
 *   _LEIA-ME.txt
 *   <P#### - Endereço>/<PREFIXO-#### - Serviço>/descricao.txt + fotos/vídeos
 */

const csvCell = (v: unknown) => {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
const safe = (s: string) => String(s || '').replace(/[\/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || '_';
const pad4 = (n: number | null | undefined) => String(n ?? 0).padStart(4, '0');
const money = (v: unknown) => Number(v ?? 0).toFixed(2);

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return new Response(JSON.stringify({ ok: false, error: 'Não autenticado.' }), { status: 401 });
  const role = String(user.role || '').toLowerCase();
  if (role !== 'super_admin' && role !== 'admin' && role !== 'manager') {
    return new Response(JSON.stringify({ ok: false, error: 'Acesso negado.' }), { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    let clientId = scope.ok ? scope.clientId : '';
    if (!clientId && role === 'super_admin') {
      const anyEx = await prisma.pmExpense.findFirst({ orderBy: { createdAt: 'desc' }, select: { clientId: true } });
      if (anyEx?.clientId) clientId = anyEx.clientId;
    }
    if (!clientId) return new Response(JSON.stringify({ ok: false, error: 'Sem cliente resolvível.' }), { status: 400 });

    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? (url.searchParams.get('month') as string) : '';
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { jobPrefix: true, companyName: true } });
    const prefix = client?.jobPrefix || 'MGP';

    const expenses = await prisma.pmExpense.findMany({
      where: { clientId, ...(month ? { monthRef: month } : {}) },
      orderBy: [{ propertyId: 'asc' }, { jobNumber: 'asc' }],
      select: {
        id: true, jobNumber: true, serviceType: true, description: true, vendorCost: true, ownerCharged: true,
        serviceDate: true, monthRef: true, status: true,
        property: { select: { code: true, address: true } },
        vendor: { select: { companyName: true } },
      },
    });
    if (!expenses.length) return new Response(JSON.stringify({ ok: false, error: 'Nenhuma despesa' + (month ? ' em ' + month : '') + '.' }), { status: 404 });

    const photos = await prisma.jobPhoto.findMany({
      where: { jobId: { in: expenses.map((e) => e.id) } },
      select: { jobId: true, r2Key: true, filename: true, contentType: true },
    });
    const byJob = new Map<string, typeof photos>();
    for (const p of photos) { const a = byJob.get(p.jobId) || []; a.push(p); byJob.set(p.jobId, a); }

    const r2 = getR2Client();
    const bucket = getR2Bucket();

    // ---- CSV índice ----
    const head = ['Work Order', 'Casa (codigo)', 'Endereco', 'Vendor', 'Servico', 'Custo Vendor', 'Custo Owner', 'Data', 'Mes', 'Status', 'Descricao', 'Nº Midias'];
    const csvLines = [head.map(csvCell).join(',')];
    for (const e of expenses) {
      const wo = `${prefix}-${pad4(e.jobNumber)}`;
      csvLines.push([
        wo, e.property?.code || '', e.property?.address || '', e.vendor?.companyName || '',
        e.serviceType || '', money(e.vendorCost), money(e.ownerCharged),
        e.serviceDate ? e.serviceDate.toISOString().slice(0, 10) : '', e.monthRef || '', e.status,
        e.description || '', String((byJob.get(e.id) || []).length),
      ].map(csvCell).join(','));
    }

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', (err: Error) => console.error('[export-zip archiver]', err?.message || err));

    // Monta o ZIP em segundo plano; a resposta é o stream (streaming com backpressure).
    (async () => {
      try {
        archive.append('﻿' + csvLines.join('\r\n'), { name: '_INDICE.csv' });
        archive.append(
          `Export de despesas — ${client?.companyName || ''}${month ? ' — ' + month : ''}\r\n` +
          `Total de despesas: ${expenses.length} · Mídias: ${photos.length}\r\n\r\n` +
          `Organizacao: uma pasta por CASA, dentro uma pasta por Work Order com as fotos/videos e descricao.txt.\r\n` +
          `Use o _INDICE.csv como guia para o upload no AppSheet.\r\n`,
          { name: '_LEIA-ME.txt' },
        );
        for (const e of expenses) {
          const wo = `${prefix}-${pad4(e.jobNumber)}`;
          const houseFolder = safe(`${e.property?.code || 'SEM-CODIGO'} - ${e.property?.address || 'Sem endereco'}`);
          const woFolder = safe(`${wo}${e.serviceType ? ' - ' + e.serviceType : ''}`);
          const base = `${houseFolder}/${woFolder}`;
          const desc =
            `WORK ORDER: ${wo}\r\nCASA: ${e.property?.code || ''} - ${e.property?.address || ''}\r\n` +
            `VENDOR: ${e.vendor?.companyName || ''}\r\nSERVICO: ${e.serviceType || ''}\r\n` +
            `CUSTO VENDOR: ${money(e.vendorCost)} | CUSTO OWNER: ${money(e.ownerCharged)}\r\n` +
            `DATA: ${e.serviceDate ? e.serviceDate.toISOString().slice(0, 10) : ''} | MES: ${e.monthRef || ''} | STATUS: ${e.status}\r\n\r\n` +
            `DESCRICAO:\r\n${e.description || '(sem descricao)'}\r\n`;
          archive.append(desc, { name: `${base}/descricao.txt` });
          const list = byJob.get(e.id) || [];
          for (let i = 0; i < list.length; i++) {
            const ph = list[i];
            try {
              const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: ph.r2Key }));
              const bytes = await (obj.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
              const fname = safe(ph.filename || `midia-${i + 1}`);
              archive.append(Buffer.from(bytes), { name: `${base}/${fname}` });
            } catch (err) {
              archive.append(`Falha ao baixar: ${ph.r2Key} (${err instanceof Error ? err.message : 'erro'})`, { name: `${base}/_FALTOU-${i + 1}.txt` });
            }
          }
        }
        await archive.finalize();
      } catch (err) {
        console.error('[export-zip build]', err instanceof Error ? err.message : err);
        try { archive.abort(); } catch { /* noop */ }
      }
    })();

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `${(client?.companyName || 'Expenses').replace(/[^A-Za-z0-9]+/g, '_')}_Expenses${month ? '_' + month : ''}_${stamp}.zip`;
    return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/pm/expenses/export-zip]', e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ ok: false, error: 'Falha ao gerar o ZIP.' }), { status: 500 });
  }
}
