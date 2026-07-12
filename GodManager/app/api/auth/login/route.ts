import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { verifyPassword, hashPassword } from '@/lib/password';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
} from '@/lib/rateLimit';
import { createSessionCookie } from '@/lib/authServer';
import { decryptField } from '@/lib/encryption';
import { verifyTotp, hashBackupCode } from '@/lib/totp';
import type { UserRole } from '@/lib/types';

function isDatabaseUnreachable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P1001', 'P1017'].includes(e.code);
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /Can't reach database|ECONNREFUSED|connection refused|Server has closed the connection/i.test(msg);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!emailRaw || !password) {
      return NextResponse.json({ ok: false, error: 'Email e password sao obrigatorios.' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `${ip}:${emailRaw}`;
    const limit = checkLoginRateLimit(key);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'too_many_attempts', retryAfter: limit.retryAfterSeconds },
        { status: 429 },
      );
    }

    let user = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (!user) {
      const users = await prisma.user.findMany({});
      user = users.find((u) => u.email.toLowerCase().split('@')[0] === emailRaw) || null;
    }

    if (!user) {
      recordFailedLogin(key);
      return NextResponse.json({ ok: false, error: 'Email ou password invalidos.' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ ok: false, error: 'Conta suspensa. Contacta o administrador.' }, { status: 403 });
    }
    if (user.status === 'pending') {
      return NextResponse.json({ ok: false, error: 'Conta pendente de aprovacao.' }, { status: 403 });
    }

    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      recordFailedLogin(key);
      return NextResponse.json({ ok: false, error: 'Email ou password invalidos.' }, { status: 401 });
    }

    // MFA (TOTP) — só para quem ativou. Não afeta contas sem MFA.
    if (user.mfaEnabled && user.mfaSecret) {
      const mfaCode = String(body?.mfaCode || '').trim();
      if (!mfaCode) {
        // senha ok, mas falta o 2º fator → UI pede o código
        return NextResponse.json({ ok: false, mfaRequired: true, error: 'Código de verificação necessário.' }, { status: 200 });
      }
      const secret = decryptField(user.mfaSecret) || '';
      let mfaOk = secret ? verifyTotp(secret, mfaCode) : false;
      // fallback: código de backup (consumido)
      if (!mfaOk && user.mfaBackupCodes) {
        try {
          const codes: string[] = JSON.parse(decryptField(user.mfaBackupCodes) || '[]');
          const h = hashBackupCode(mfaCode);
          const idx = codes.indexOf(h);
          if (idx >= 0) {
            mfaOk = true;
            codes.splice(idx, 1);
            const { encryptField } = await import('@/lib/encryption');
            await prisma.user.update({ where: { id: user.id }, data: { mfaBackupCodes: encryptField(JSON.stringify(codes)) } });
          }
        } catch { /* ignore */ }
      }
      if (!mfaOk) {
        recordFailedLogin(key);
        return NextResponse.json({ ok: false, mfaRequired: true, error: 'Código de verificação inválido.' }, { status: 401 });
      }
    }

    clearLoginAttempts(key);

    const updateData: { lastActive: Date; passwordHash?: string } = {
      lastActive: new Date(),
    };
    if (needsRehash) {
      updateData.passwordHash = await hashPassword(password);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    const cookie = createSessionCookie(user.id, user.role as UserRole);
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
      },
    });
    res.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });
    return res;
  } catch (e) {
    console.error('[api/auth/login]', e);
    if (isDatabaseUnreachable(e)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Base de dados indisponivel. Confirma que o Postgres esta a correr e que DATABASE_URL no .env.local esta correcto (ex.: docker compose up -d na raiz do GodManager).',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
