/**
 * Cria um novo Client + primeiro utilizador admin (role admin) numa única transação.
 * Idempotência: se o email do Client ou do User admin já existir, o script termina sem escrever.
 *
 * Uso típico (dry-run primeiro):
 *
 * DATABASE_URL="..." ADMIN_INITIAL_PWD='SenhaForte123' npx tsx scripts/create-client.ts \
 *   --company-name "Una" \
 *   --contact-name "Nome Contato Una" \
 *   --email "contato@una.com.br" \
 *   --product-type DESIGN_DECORATION \
 *   --admin-first-name "Admin" \
 *   --admin-last-name "Una" \
 *   --admin-email "admin@una.com.br" \
 *   --admin-password-env ADMIN_INITIAL_PWD \
 *   --dry-run
 *
 * Depois remover --dry-run para aplicar.
 */
import { ClientPlan, ClientProductType, PrismaClient } from '@prisma/client';

import { hashPassword } from '@/lib/password';

const prisma = new PrismaClient();

const VALID_PRODUCT_TYPES: readonly ClientProductType[] = [
  'PROPERTY_MANAGEMENT',
  'DESIGN_DECORATION',
  'EXPENSES_JOBS',
];
const VALID_PLANS: readonly ClientPlan[] = ['starter', 'professional', 'enterprise'];

type ParsedArgs = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string | undefined;
  address: string | undefined;
  productType: ClientProductType;
  plan: ClientPlan;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPasswordEnv: string;
  dryRun: boolean;
};

function fail(msg: string): never {
  console.error('[create-client]', msg);
  process.exitCode = 1;
  throw new Error(msg);
}

/** Parse CLI: --flag value e --dry-run sem valor obrigatório */
function parseArgs(argv: string[]): ParsedArgs {
  const raw: Record<string, string> = {};
  let dryRun = false;

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (!token.startsWith('--')) {
      fail(`Argumento inválido (esperado --flag): ${token}`);
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      fail(`Falta valor para --${key}`);
    }
    raw[key] = next;
    i++;
  }

  const need = (snakeKey: string): string => {
    const v = raw[snakeKey]?.trim();
    if (!v) fail(`Campo obrigatório: --${snakeKey}`);
    return v;
  };

  const companyName = need('company-name');
  const contactName = need('contact-name');
  const email = need('email');
  const adminFirstName = need('admin-first-name');
  const adminLastName = need('admin-last-name');
  const adminEmail = need('admin-email');
  const adminPasswordEnv = need('admin-password-env');

  const phoneRaw = raw['phone']?.trim();
  const addressRaw = raw['address']?.trim();

  const productTypeRaw = (raw['product-type'] ?? 'PROPERTY_MANAGEMENT').trim();
  if (!VALID_PRODUCT_TYPES.includes(productTypeRaw as ClientProductType)) {
    fail(
      `--product-type inválido: "${productTypeRaw}". Use um de: ${VALID_PRODUCT_TYPES.join(', ')}`,
    );
  }
  const productType = productTypeRaw as ClientProductType;

  const planRaw = (raw['plan'] ?? 'starter').trim().toLowerCase();
  const plan = planRaw as ClientPlan;
  if (!VALID_PLANS.includes(plan)) {
    fail(`--plan inválido: "${planRaw}". Use um de: ${VALID_PLANS.join(', ')}`);
  }

  return {
    companyName,
    contactName,
    email,
    phone: phoneRaw || undefined,
    address: addressRaw || undefined,
    productType,
    plan,
    adminFirstName,
    adminLastName,
    adminEmail,
    adminPasswordEnv,
    dryRun,
  };
}

/** Senha na env var + unicidade de emails — antes de qualquer escrita ao resumo/execução */
async function validatePreWrite(args: ParsedArgs): Promise<string> {
  const pwdRaw = process.env[args.adminPasswordEnv];
  if (pwdRaw === undefined || pwdRaw === '') {
    fail(
      `Senha não encontrada em process.env.${args.adminPasswordEnv} (defina a variável antes de executar).`,
    );
  }
  if (pwdRaw.length < 8) {
    fail(`Senha em ${args.adminPasswordEnv} deve ter pelo menos 8 caracteres.`);
  }

  const [existingClient, existingUserAdmin] = await Promise.all([
    prisma.client.findUnique({ where: { email: args.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: args.adminEmail }, select: { id: true } }),
  ]);

  if (existingClient) {
    fail(`Client com email já existe: ${args.email}`);
  }
  if (existingUserAdmin) {
    fail(`User com admin-email já existe: ${args.adminEmail}`);
  }

  return pwdRaw;
}

function printSummary(args: ParsedArgs): void {
  console.log('');
  console.log('=== Resumo (create-client) ===');
  console.log('  Client.companyName:', args.companyName);
  console.log('  Client.contactName:', args.contactName);
  console.log('  Client.email:      ', args.email);
  console.log('  Client.phone:      ', args.phone ?? '(não definido)');
  console.log('  Client.address:    ', args.address ?? '(não definido)');
  console.log('  Client.productType:', args.productType);
  console.log('  Client.plan:       ', args.plan);
  console.log('  User (admin).first:', args.adminFirstName);
  console.log('  User (admin).last: ', args.adminLastName);
  console.log('  User (admin).email:', args.adminEmail);
  console.log('  Senha obtida via env:', args.adminPasswordEnv, '(valor não mostrado)');
  console.log('  Modo:              ', args.dryRun ? 'DRY-RUN' : 'EXECUTAR TRANSAÇÃO');
  console.log('==============================');
  console.log('');
}

async function main() {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv);
  } catch {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 1);
    return;
  }

  let plainPassword: string;
  try {
    plainPassword = await validatePreWrite(args);
  } catch {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 1);
    return;
  }

  printSummary(args);

  if (args.dryRun) {
    console.log('DRY-RUN: no writes performed.');
    await prisma.$disconnect();
    return;
  }

  const pwdHash = await hashPassword(plainPassword);

  const created = await prisma.$transaction(async (tx) => {
    const createdClient = await tx.client.create({
      data: {
        companyName: args.companyName,
        contactName: args.contactName,
        email: args.email,
        phone: args.phone ?? null,
        address: args.address ?? null,
        plan: args.plan,
        productType: args.productType,
      },
    });
    const createdUser = await tx.user.create({
      data: {
        firstName: args.adminFirstName,
        lastName: args.adminLastName,
        email: args.adminEmail,
        role: 'admin',
        status: 'active',
        permissions: [],
        passwordHash: pwdHash,
        clientId: createdClient.id,
      },
    });
    return { createdClient, createdUser };
  });

  console.log('[create-client] Client.id:', created.createdClient.id);
  console.log('[create-client] User.id: ', created.createdUser.id);
  console.log(
    `[create-client] Login em /login com email=${args.adminEmail} e a senha de $${args.adminPasswordEnv}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
