import { NextResponse } from 'next/server';
import type { ClientPlan, ClientProductType, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { hashPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

const VALID_PRODUCT_TYPES: ClientProductType[] = [
  'PROPERTY_MANAGEMENT',
  'DESIGN_DECORATION',
  'EXPENSES_JOBS',
];
const VALID_PLANS: ClientPlan[] = ['starter', 'professional', 'enterprise'];

function mapAccessLevel(v: string): UserRole {
  const u = String(v || '').toUpperCase();
  if (u === 'ADMIN') return 'admin';
  if (u === 'MANAGER') return 'manager';
  return 'viewer';
}

async function requireSuperAdmin(): Promise<
  | { ok: false; status: number; body: { ok: false; error: string } }
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUserFromSession>>> }
> {
  const user = await getCurrentUserFromSession();
  if (!user) return { ok: false, status: 401, body: { ok: false, error: 'Nao autenticado.' } };
  if (user.role !== 'super_admin')
    return { ok: false, status: 403, body: { ok: false, error: 'Acesso negado.' } };
  return { ok: true, user };
}

/** Lista Client na base — apenas super_admin (gestão multi-tenant). */
export async function GET() {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  try {
    const rows = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { status: 'active' },
          select: { id: true },
        },
      },
    });

    const clients = rows.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone ?? '',
      address: c.address ?? '',
      plan: c.plan,
      productType: c.productType,
      accessLevel: String(c.accessLevel || 'viewer').toUpperCase(),
      active: c.active,
      activeUserCount: c.users.length,
      createdAt: c.createdAt.toISOString(),
      _fromApi: true as const,
    }));

    return NextResponse.json({ ok: true, clients });
  } catch (e) {
    console.error('[api/admin/clients GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

type AdminPayload = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  password?: unknown;
};

/** Cria Client + primeiro utilizador admin (password bcrypt) — apenas super_admin. */
export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  try {
    const body = await req.json().catch(() => ({}));

    const companyName = String(body?.companyName ?? body?.company ?? '').trim();
    const contactName = String(body?.contactName ?? body?.contact ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const phoneRaw = body?.phone != null ? String(body.phone).trim() : '';
    const phone = phoneRaw.length ? phoneRaw : null;

    const planRaw = String(body?.plan ?? 'professional').trim().toLowerCase();
    const productRaw = String(body?.productType ?? 'PROPERTY_MANAGEMENT').trim().toUpperCase();
    const accessRaw = String(body?.accessLevel ?? 'ADMIN').trim();

    const admin = (body?.admin ?? {}) as AdminPayload;
    const adminFirstName = String(admin.firstName ?? '').trim();
    const adminLastName = String(admin.lastName ?? '').trim();
    let adminEmail = String(admin.email ?? '').trim().toLowerCase();
    const passwordRaw = String(admin.password ?? '').trim();

    if (!companyName || !contactName || !email) {
      return NextResponse.json(
        { ok: false, error: 'companyName, contactName e email da empresa são obrigatórios.' },
        { status: 400 },
      );
    }

    if (!adminFirstName || !adminLastName) {
      return NextResponse.json(
        { ok: false, error: 'Nome e apelido do administrador são obrigatórios.' },
        { status: 400 },
      );
    }

    if (!adminEmail) adminEmail = email;

    if (!passwordRaw || passwordRaw.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Senha do administrador: mínimo 8 caracteres.' },
        { status: 400 },
      );
    }

    if (!VALID_PLANS.includes(planRaw as ClientPlan)) {
      return NextResponse.json({ ok: false, error: 'Plano inválido.' }, { status: 400 });
    }

    if (!VALID_PRODUCT_TYPES.includes(productRaw as ClientProductType)) {
      return NextResponse.json({ ok: false, error: 'Produto inválido.' }, { status: 400 });
    }

    const clientAccessLevel = mapAccessLevel(accessRaw);

    const [existingClient, existingAdminUser] = await Promise.all([
      prisma.client.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } }),
    ]);

    if (existingClient) {
      return NextResponse.json(
        { ok: false, error: 'Email da empresa já registado.' },
        { status: 409 },
      );
    }

    if (existingAdminUser) {
      return NextResponse.json({ ok: false, error: 'Email já em uso' }, { status: 409 });
    }

    const passwordHash = await hashPassword(passwordRaw);

    const result = await prisma.$transaction(async (tx) => {
      const createdClient = await tx.client.create({
        data: {
          companyName,
          contactName,
          email,
          phone,
          plan: planRaw as ClientPlan,
          productType: productRaw as ClientProductType,
          accessLevel: clientAccessLevel,
          active: true,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          firstName: adminFirstName,
          lastName: adminLastName,
          email: adminEmail,
          role: 'admin',
          status: 'active',
          permissions: [],
          passwordHash,
          clientId: createdClient.id,
        },
      });

      return { createdClient, createdUser };
    });

    return NextResponse.json({
      ok: true,
      client: {
        id: result.createdClient.id,
        companyName: result.createdClient.companyName,
        contactName: result.createdClient.contactName,
        email: result.createdClient.email,
        phone: result.createdClient.phone,
        plan: result.createdClient.plan,
        productType: result.createdClient.productType,
        accessLevel: String(result.createdClient.accessLevel).toUpperCase(),
        active: result.createdClient.active,
      },
      adminUser: {
        id: result.createdUser.id,
        email: result.createdUser.email,
      },
    });
  } catch (e) {
    console.error('[api/admin/clients POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
