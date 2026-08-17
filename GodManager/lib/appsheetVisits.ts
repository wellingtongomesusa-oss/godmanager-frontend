/**
 * Integração AppSheet → Expenses (somente informação, read-only).
 * Visitas de campo exportadas do AppSheet (log "Job_LongTerm": técnico, horas, GPS, notas por casa).
 * Armazenadas por cliente em AppSetting `appsheet:visits:<clientId>` (value Json) — SEM migração.
 * A tela de Expenses (#ltexpenses) mostra essas visitas com um selo "AppSheet" deixando claro que a
 * ORIGEM é o AppSheet e que é apenas integração de informação (não é uma despesa/job do GodManager).
 */

export interface AppSheetVisit {
  sourceId: string;
  date: string;        // YYYY-MM-DD
  month: string;       // YYYY-MM
  propertyName: string;
  address: string;
  city: string;
  state: string;
  buildingType: string;
  owner: string;
  member: string;      // técnico que atendeu
  hours: number;       // time_decimal
  notes: string;
  gps: string;
}

export interface AppSheetVisitsPayload {
  visits: AppSheetVisit[];
  count: number;
  source: string;
  updatedAt: string;
}

export const appSheetVisitsKey = (clientId: string) => `appsheet:visits:${clientId}`;

/** Parser CSV tolerante a aspas (campos com vírgula/aspas duplas). */
export function parseCsv(txt: string): string[][] {
  const rows: string[][] = [];
  let i = 0, f = '', row: string[] = [], q = false;
  const pushF = () => { row.push(f); f = ''; };
  const pushR = () => { rows.push(row); row = []; };
  while (i < txt.length) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') pushF();
      else if (c === '\n') { pushF(); pushR(); }
      else if (c === '\r') { /* ignora */ }
      else f += c;
    }
    i++;
  }
  if (f.length || row.length) { pushF(); pushR(); }
  return rows;
}

const pad2 = (n: string | number) => String(n).padStart(2, '0');
/** M/D/YYYY → YYYY-MM-DD (formato do export AppSheet). '' se não parsear. */
export function appSheetIsoDate(s: string): string {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
}

/** Normaliza o CSV do AppSheet (Job_LongTerm) numa lista de visitas. */
export function normalizeAppSheetCsv(csvText: string): AppSheetVisit[] {
  const rows = parseCsv(csvText);
  if (!rows.length) return [];
  const hdr = rows[0].map((h) => h.trim());
  const idx = (n: string) => hdr.indexOf(n);
  const iId = idx('id'), iDate = idx('date'), iProp = idx('property_name'), iAddr = idx('address');
  const iCity = idx('city'), iState = idx('state'), iBt = idx('building_type'), iOwner = idx('rental_owner');
  const iMember = idx('member'), iHours = idx('time_decimal'), iNotes = idx('notes'), iGps = idx('localization');
  const out: AppSheetVisit[] = [];
  for (const r of rows.slice(1)) {
    const id = iId >= 0 ? String(r[iId] || '').trim() : '';
    if (!id) continue;
    const date = appSheetIsoDate(iDate >= 0 ? r[iDate] : '');
    const cell = (i: number) => (i >= 0 ? String(r[i] || '').trim() : '');
    out.push({
      sourceId: id, date, month: date ? date.slice(0, 7) : '',
      propertyName: cell(iProp), address: cell(iAddr), city: cell(iCity), state: cell(iState),
      buildingType: cell(iBt), owner: cell(iOwner), member: cell(iMember),
      hours: Number(cell(iHours)) || 0, notes: cell(iNotes), gps: cell(iGps),
    });
  }
  return out;
}
