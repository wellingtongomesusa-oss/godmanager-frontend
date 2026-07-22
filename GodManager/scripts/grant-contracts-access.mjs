// Garante acesso ao módulo Contratos (e ao app) para Lucas Coelho e Guilherme Leal:
// coloca-os como `manager` (se estiverem abaixo) e vinculados à empresa Manager Prop.
// Papéis que já veem Contratos: super_admin | admin | manager.
//
// Uso:
//   node scripts/grant-contracts-access.mjs            (dry-run — só mostra o que faria)
//   node scripts/grant-contracts-access.mjs --apply    (aplica no banco)
//
// NÃO cria contas nem mexe em senha. Se o usuário não existir, apenas reporta.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const EMAILS = ['coelho@coelho.com', 'contact@managerprop.com'];
const OK_ROLES = new Set(['super_admin', 'admin', 'manager']);

async function main() {
  const client = await prisma.client.findFirst({
    where: { companyName: { contains: 'Manager Prop', mode: 'insensitive' } },
    select: { id: true, companyName: true },
  });
  if (!client) {
    console.log('❌ Empresa "Manager Prop" não encontrada. Abortando.');
    return;
  }
  console.log(`Empresa: ${client.companyName} (${client.id})`);
  console.log(APPLY ? '== MODO APPLY ==' : '== DRY-RUN (nada será alterado) ==');

  for (const email of EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, clientId: true },
    });
    if (!user) {
      console.log(`\n• ${email}: ❌ NÃO existe. Crie na tela Users (Add User) e rode de novo.`);
      continue;
    }
    const data = {};
    const changes = [];
    if (!OK_ROLES.has(String(user.role))) { data.role = 'manager'; changes.push(`role ${user.role} -> manager`); }
    if (!user.clientId) { data.clientId = client.id; changes.push(`empresa -> ${client.companyName}`); }
    if (user.status !== 'active') { data.status = 'active'; changes.push(`status ${user.status} -> active`); }

    console.log(`\n• ${email} (${user.firstName} ${user.lastName}) — role=${user.role}, status=${user.status}, empresa=${user.clientId || '—'}`);
    if (!changes.length) { console.log('  ✔ já tem acesso (nada a mudar).'); continue; }
    console.log('  ' + (APPLY ? 'aplicando: ' : 'faria: ') + changes.join(', '));
    if (APPLY) {
      await prisma.user.update({ where: { id: user.id }, data });
      console.log('  ✔ atualizado.');
    }
  }
  console.log('\nPronto.' + (APPLY ? '' : ' (rode com --apply para efetivar.)'));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
