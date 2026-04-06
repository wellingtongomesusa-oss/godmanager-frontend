import { NextRequest, NextResponse } from 'next/server';

const MOCK_USUARIOS = [
  { id: '1', email: 'cliente1@exemplo.com', name: 'Cliente Um', phone: '+5511999990001', role: 'CUSTOMER', createdAt: new Date().toISOString() },
  { id: '2', email: 'cliente2@exemplo.com', name: 'Cliente Dois', phone: '+5511999990002', role: 'CUSTOMER', createdAt: new Date().toISOString() },
];

/**
 * Lista cadastros (usuários) para o dashboard.
 * Exige header X-Dashboard-Secret igual a DASHBOARD_API_SECRET.
 * Com banco (Prisma): retorna usuários reais. Sem banco: retorna mock.
 * GET /api/v1/admin/cadastros
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('X-Dashboard-Secret') ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  const expected = process.env.DASHBOARD_API_SECRET ?? process.env.MASTER_PASSWORD ?? '';

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    let usuarios: Array<{
      id: string;
      email: string;
      name: string | null;
      phone: string | null;
      role: string;
      createdAt: string;
    }> = [];

    if (process.env.DATABASE_URL) {
      try {
        const { prisma } = await import('@/lib/db');
        const users = await prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        });
        usuarios = users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name ?? null,
          phone: u.phone ?? null,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
        }));
      } catch {
        usuarios = MOCK_USUARIOS;
      }
    } else {
      usuarios = MOCK_USUARIOS;
    }

    return NextResponse.json({
      usuarios,
      total: usuarios.length,
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao listar cadastros' }, { status: 500 });
  }
}
