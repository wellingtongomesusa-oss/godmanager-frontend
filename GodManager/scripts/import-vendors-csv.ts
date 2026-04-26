import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function findCsv(): string {
  const opts = [
    '/Users/wellingtongomes/Downloads/vendor_directory-20260422.csv',
    '/mnt/user-data/uploads/vendor_directory-20260422.csv',
    path.resolve(__dirname, '..', '..', 'vendor_directory-20260422.csv'),
  ];
  for (const p of opts) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('CSV nao encontrado: ' + opts.join(', '));
}

function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/);
  if (!lines.length) return [];
  const headerLine = lines[0];
  const headers = splitCsvLine(headerLine);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const vals = splitCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (vals[idx] || '').trim();
    });
    out.push(obj);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const vals: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      vals.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  vals.push(cur);
  return vals.map((v) => v.trim());
}

function cleanPhone(raw: string): string {
  if (!raw) return '';
  return raw.replace(/^Phone:\s*/i, '').trim();
}

function parseAddress(raw: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  if (!raw) return { street: '', city: '', state: '', zip: '' };
  const m = raw.match(/^(.*?)\s+([A-Za-z .'-]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
  if (m) {
    return {
      street: (m[1] || '').trim(),
      city: (m[2] || '').trim(),
      state: (m[3] || '').trim(),
      zip: (m[4] || '').trim(),
    };
  }
  return { street: raw.trim(), city: '', state: '', zip: '' };
}

function parseExpDate(raw: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function main() {
  const csvPath = findCsv();
  console.log('CSV:', csvPath);
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(raw);
  console.log('Rows parsed:', rows.length);

  let ins = 0;
  let upd = 0;
  let sk = 0;

  for (const r of rows) {
    const companyName = String(r['Company Name'] || '').trim();
    if (!companyName) {
      sk++;
      continue;
    }

    const contactName = String(r['Name'] || '').trim() || null;
    const phone = cleanPhone(String(r['Phone Numbers'] || ''));
    const email = String(r['Email'] || '').trim();
    const addr = parseAddress(String(r['Address'] || ''));
    const paymentType = String(r['Payment Type'] || '').trim() || null;
    const send1099Raw = String(r['Send 1099?'] || '').trim().toLowerCase();
    const send1099 = send1099Raw === 'yes' || send1099Raw === 'y' || send1099Raw === 'true';
    const tags = String(r['Tags'] || '').trim() || null;
    const portalActive = String(r['Vendor Portal Activated?'] || '').trim();

    const metadata: Record<string, unknown> = {
      csv_import: true,
      csv_file: path.basename(csvPath),
      default_gl_account: String(r['Default GL Account'] || '').trim() || null,
      tags,
      vendor_portal_activated: portalActive || null,
      workers_comp_expiration: parseExpDate(String(r["Worker's Comp. Expiration"] || '')),
      liability_insurance_expiration: parseExpDate(
        String(r['Liability Insurance Expiration'] || ''),
      ),
      epa_certification_expiration: parseExpDate(String(r['EPA Certification Expiration'] || '')),
      auto_insurance_expiration: parseExpDate(String(r['Auto Insurance Expiration'] || '')),
      state_license_expiration: parseExpDate(String(r['State License Expiration'] || '')),
      contract_expiration: parseExpDate(String(r['Contract Expiration'] || '')),
    };

    const data = {
      companyName,
      contactName,
      email,
      phone,
      addressStreet: addr.street,
      addressCity: addr.city || null,
      addressState: addr.state || null,
      addressZip: addr.zip || null,
      paymentType,
      send1099,
      source: 'csv',
      metadata: metadata as object,
    };

    try {
      const ex = await prisma.pmVendor.findFirst({ where: { companyName } });
      if (ex) {
        await prisma.pmVendor.update({ where: { id: ex.id }, data });
        upd++;
      } else {
        await prisma.pmVendor.create({ data });
        ins++;
      }
    } catch (e) {
      console.error('Error', companyName, e);
      sk++;
    }
  }

  console.log({ ins, upd, sk, total: rows.length });
  const total = await prisma.pmVendor.count();
  const fromCsv = await prisma.pmVendor.count({ where: { source: 'csv' } });
  console.log('Total vendors em Postgres:', total);
  console.log('Total source=csv:', fromCsv);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
