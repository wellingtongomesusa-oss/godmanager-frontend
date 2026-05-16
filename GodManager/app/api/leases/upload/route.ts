import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { LeaseStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else cell += c;
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ',') {
      cur.push(cell);
      cell = '';
    } else if (c === '\n') {
      cur.push(cell);
      rows.push(cur);
      cur = [];
      cell = '';
    } else if (c !== '\r') {
      cell += c;
    }
  }
  if (cell.length || cur.length) {
    cur.push(cell);
    rows.push(cur);
  }
  return rows;
}

function parseAmount(s: string): Prisma.Decimal | null {
  if (!s?.trim()) return null;
  const clean = String(s).replace(/[",$]/g, '').replace(/\s/g, '').trim();
  if (!clean) return null;
  const n = parseFloat(clean);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

function normalizeHeaderCell(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugHeader(h: string): string {
  return normalizeHeaderCell(h).replace(/[^a-z0-9]+/g, '');
}

/** Try parse common US CSV date formats → UTC midday for stable ordering */
function parseDateFlexible(s: string): Date | null {
  const t = s?.trim();
  if (!t) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (mdy) {
    const mo = Number(mdy[1]);
    const dy = Number(mdy[2]);
    const yr = Number(mdy[3]);
    const d = new Date(Date.UTC(yr, mo - 1, dy, 12, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dms = Date.parse(t);
  if (!Number.isNaN(dms)) return new Date(dms);
  return null;
}

function normAddr(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function fullPropertyLine(p: { address: string; city?: string | null; state?: string | null; zip?: string | null }) {
  return [p.address, p.city, p.state, p.zip].filter(Boolean).join(' ').trim();
}

/** Find header column index matching any alias substring */
function colIndex(headers: string[], aliases: string[]): number {
  const slugs = headers.map(slugHeader);
  for (const a of aliases) {
    const sa = slugHeader(a);
    for (let i = 0; i < slugs.length; i++) {
      if (!slugs[i]) continue;
      if (slugs[i] === sa || slugs[i].includes(sa) || sa.includes(slugs[i])) return i;
    }
  }
  return -1;
}

function deriveStatus(csvStatusRaw: string, leaseStart: Date | null, leaseEnd: Date | null): LeaseStatus {
  const csv = csvStatusRaw.toLowerCase();
  if (/terminat|ended|notice|cancellation|vacat|^inactive\b/.test(csv)) {
    return LeaseStatus.TERMINATED;
  }
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const d0 = (d: Date | null) =>
    d
      ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      : null;
  const s = d0(leaseStart);
  const e = d0(leaseEnd);
  if (s !== null && s > today) return LeaseStatus.FUTURE;
  if (e !== null && e < today) return LeaseStatus.EXPIRED;
  if (/active|occup|renew|held|live|current|^a$/.test(csv)) return LeaseStatus.ACTIVE;
  if (csv.trim()) return LeaseStatus.UNKNOWN;
  if (leaseStart || leaseEnd) {
    if (s !== null && s <= today && (e === null || e >= today)) return LeaseStatus.ACTIVE;
    return LeaseStatus.UNKNOWN;
  }
  return LeaseStatus.UNKNOWN;
}

function leaseRecordHash(parts: {
  clientId: string;
  propertyAddress: string;
  unit: string | null;
  tenantName: string;
  leaseStartIso: string;
  leaseEndIso: string;
  monthlyRentStr: string;
  securityDepositStr: string;
}): string {
  const base = [
    parts.clientId,
    normAddr(parts.propertyAddress),
    parts.unit ? normAddr(parts.unit) : '',
    normName(parts.tenantName),
    parts.leaseStartIso,
    parts.leaseEndIso,
    parts.monthlyRentStr,
    parts.securityDepositStr,
  ].join('|');
  return createHash('sha256').update(base, 'utf8').digest('hex');
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No client context' }, { status: 400 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file required (multipart field "file")' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const contentHash = createHash('sha256').update(buf).digest('hex');

    const dup = await prisma.leaseImport.findUnique({
      where: { contentHash },
      select: { id: true, clientId: true, uploadedAt: true },
    });
    if (dup) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Duplicate file (same content hash already imported)',
          duplicateOf: dup,
        },
        { status: 409 },
      );
    }

    const text = buf.toString('utf8');
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return NextResponse.json({ ok: false, error: 'CSV empty or missing header row' }, { status: 400 });
    }

    const headers = rows[0].map((h) => h.trim());

    const iProp = colIndex(headers, [
      'Property Address',
      'Property',
      'Street Address',
      'Address',
      'Home Address',
      'Location',
    ]);
    const iUnit = colIndex(headers, ['Unit', 'Apt', 'Suite', '#']);
    const iTenant = colIndex(headers, ['Tenant', 'Tenant Name', 'Resident', 'Occupants', 'Resident Name']);
    const iStart = colIndex(headers, ['Lease Start', 'Lease From', 'Start Date', 'Move In', 'Begin']);
    const iEnd = colIndex(headers, ['Lease End', 'Lease To', 'End Date', 'Expiration', 'Expire']);
    const iRent = colIndex(headers, ['Monthly Rent', 'Rent', 'Total Rent']);
    const iDep = colIndex(headers, ['Security Deposit', 'Deposit', 'SD']);
    const iNotes = colIndex(headers, ['Notes', 'Note', 'Comment']);
    const iStatusCol = colIndex(headers, ['Status', 'Lease Status', 'Occupancy']);

    if (iProp < 0 || iTenant < 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Could not locate required columns for Property Address and Tenant (check AppFolio Lease Register CSV headers)',
        },
        { status: 400 },
      );
    }

    const [properties, tenants] = await Promise.all([
      prisma.property.findMany({
        where: { clientId },
        select: { id: true, address: true, city: true, state: true, zip: true },
      }),
      prisma.tenant.findMany({
        where: { clientId },
        select: { id: true, name: true },
      }),
    ]);

    const propNorm = properties.map((p) => ({
      ...p,
      line: normAddr(fullPropertyLine(p)),
      addr: normAddr(p.address),
    }));

    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    const leaseRowsData: Omit<Prisma.LeaseCreateManyInput, 'leaseImportId'>[] = [];
    let parsed = 0;
    let skippedEmpty = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const get = (i: number) => (i >= 0 && i < row.length ? String(row[i] ?? '').trim() : '');
      const propertyAddressRaw = get(iProp).replace(/\s+/g, ' ').trim();
      const tenantNameRaw = get(iTenant).replace(/\s+/g, ' ').trim();

      if (!propertyAddressRaw && !tenantNameRaw) {
        skippedEmpty++;
        continue;
      }

      parsed++;
      const unit = iUnit >= 0 ? get(iUnit) || null : null;
      const leaseStart = parseDateFlexible(get(iStart));
      const leaseEnd = parseDateFlexible(get(iEnd));
      const monthlyRent = parseAmount(get(iRent));
      const secDep = parseAmount(get(iDep));
      const notes = iNotes >= 0 ? get(iNotes) || null : null;
      const csvStatusRaw = iStatusCol >= 0 ? get(iStatusCol) : '';

      let propertyId: string | null = null;
      const ncsv = normAddr(propertyAddressRaw);
      const exactProp = propNorm.find((p) => p.line === ncsv || p.addr === ncsv);
      if (exactProp) propertyId = exactProp.id;
      else {
        const subset = propNorm.filter(
          (p) => ncsv.includes(p.addr) || p.addr.includes(ncsv) || ncsv.includes(p.line.split(',')[0]?.trim()),
        );
        if (subset.length === 1) propertyId = subset[0].id;
      }

      let tenantId: string | null = null;
      const nn = normName(tenantNameRaw);
      const tmatch = tenants.filter((t) => normName(t.name) === nn);
      if (tmatch.length === 1) tenantId = tmatch[0].id;

      const status = deriveStatus(csvStatusRaw, leaseStart, leaseEnd);

      const startIso = leaseStart ? leaseStart.toISOString().slice(0, 10) : '';
      const endIso = leaseEnd ? leaseEnd.toISOString().slice(0, 10) : '';
      const rentStr = monthlyRent?.toFixed(2) ?? '';
      const depStr = secDep?.toFixed(2) ?? '';

      const leaseHash = leaseRecordHash({
        clientId,
        propertyAddress: propertyAddressRaw,
        unit,
        tenantName: tenantNameRaw || 'UNKNOWN',
        leaseStartIso: startIso,
        leaseEndIso: endIso,
        monthlyRentStr: rentStr,
        securityDepositStr: depStr,
      });

      if (leaseStart && (!minStart || leaseStart < minStart)) minStart = leaseStart;
      if (leaseEnd && (!maxEnd || leaseEnd > maxEnd)) maxEnd = leaseEnd;

      leaseRowsData.push({
        clientId,
        propertyAddress: propertyAddressRaw || '(no address)',
        unit,
        tenantName: tenantNameRaw || '(unknown tenant)',
        leaseStart,
        leaseEnd,
        monthlyRent,
        securityDeposit: secDep,
        status,
        notes,
        leaseHash,
        propertyId,
        tenantId,
      });
    }

    const importRow = await prisma.leaseImport.create({
      data: {
        clientId,
        filename: file.name.replace(/[^\w.-]+/g, '_').slice(-200) || 'lease_register.csv',
        contentHash,
        rowCount: parsed,
        periodStart: minStart,
        periodEnd: maxEnd,
        uploadedById: user.id,
        uploadedBy:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.id || null,
      },
    });

    const withImport = leaseRowsData.map((d) => ({ ...d, leaseImportId: importRow.id }));
    let inserted = 0;
    const chunkSize = 200;
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < withImport.length; i += chunkSize) {
        const chunk = withImport.slice(i, i + chunkSize);
        const res = await tx.lease.createMany({ data: chunk, skipDuplicates: true });
        inserted += res.count;
      }
    });

    const skippedDuplicates = leaseRowsData.length - inserted;

    return NextResponse.json({
      ok: true,
      importId: importRow.id,
      filename: importRow.filename,
      rowCount: parsed,
      inserted,
      skippedDuplicates,
      skippedEmptyRows: skippedEmpty,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[leases/upload]', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
