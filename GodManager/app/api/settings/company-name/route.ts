import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_NAME = 'Manager Prop LLC';

export async function GET() {
  try {
    const s = await prisma.appSetting.findUnique({ where: { key: 'company_name' } });
    const value = s?.value;
    let name: string = DEFAULT_NAME;
    if (typeof value === 'string' && value.trim()) {
      name = value.trim();
    } else if (value && typeof value === 'object' && 'name' in value) {
      const n = (value as { name?: unknown }).name;
      if (typeof n === 'string' && n.trim()) name = n.trim();
    }
    return NextResponse.json({ ok: true, name });
  } catch (e) {
    console.error('[GET company-name]', e);
    return NextResponse.json({ ok: true, name: DEFAULT_NAME });
  }
}
