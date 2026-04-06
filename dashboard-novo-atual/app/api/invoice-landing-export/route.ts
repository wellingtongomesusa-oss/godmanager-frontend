import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/invoice-landing-export
 * Retorna o HTML da página Invoice Landing para download.
 */
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'invoice-landing.html');
    const html = await readFile(filePath, 'utf-8');
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="invoice-landing.html"',
      },
    });
  } catch (e) {
    console.error('[api/invoice-landing-export]', e);
    return NextResponse.json(
      { error: 'Arquivo invoice-landing.html não encontrado.' },
      { status: 404 }
    );
  }
}
