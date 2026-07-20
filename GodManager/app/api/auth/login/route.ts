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
import { sendEmail } from '@/lib/email';
import { twilioConfigured } from '@/lib/twilioSms';
import { issueSmsCode, verifySmsCode, smsErrorPt } from '@/lib/smsMfaCode';
import { PORTAL_ROLES } from '@/lib/clientPlanLimits';
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
    // Tenant bloqueado (Client.active=false) → ninguém da empresa loga. super_admin (sem clientId) passa.
    if (user.role !== 'super_admin' && user.clientId) {
      const client = await prisma.client.findUnique({ where: { id: user.clientId }, select: { active: true } });
      if (client && client.active === false) {
        return NextResponse.json({ ok: false, error: 'Empresa suspensa. Contacte o suporte.' }, { status: 403 });
      }
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

    // 2FA por SMS (Twilio) — OBRIGATÓRIO só para quem JÁ tem telefone cadastrado, e SÓ quando o
    // Twilio está configurado. Sem Twilio, o login segue normal (zero lockout). Não se aplica a
    // quem já usa TOTP (evita 2 fatores), nem a papéis de portal (owner/tenant/vendor).
    // Válvula de segurança: SMS_MFA_LOGIN_DISABLED=1 desliga o enforcement mesmo com Twilio ativo.
    const isPortalRole = (PORTAL_ROLES as readonly string[]).includes(String(user.role));
    const smsMfaApplies =
      twilioConfigured() &&
      process.env.SMS_MFA_LOGIN_DISABLED !== '1' &&
      !!user.phone &&
      !(user.mfaEnabled && user.mfaSecret) &&
      !isPortalRole;
    if (smsMfaApplies) {
      const smsCode = String(body?.smsCode || '').trim();
      if (!smsCode) {
        const issued = await issueSmsCode(user.id, user.phone as string);
        return NextResponse.json(
          {
            ok: false,
            smsMfaRequired: true,
            to: issued.to ?? null,
            error: issued.ok
              ? 'Enviamos um código por SMS. Digite-o para entrar.'
              : smsErrorPt(issued.error),
          },
          { status: 200 },
        );
      }
      const check = await verifySmsCode(user.id, smsCode);
      if (!check.ok) {
        recordFailedLogin(key);
        return NextResponse.json(
          { ok: false, smsMfaRequired: true, error: smsErrorPt(check.error) },
          { status: 401 },
        );
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

    // Alerta de login de novo dispositivo/IP — PURAMENTE ADITIVO: envelopado em try/catch,
    // nunca bloqueia nem altera o login, nao apaga nada. Registra cada login bem-sucedido no
    // audit (ip+userAgent) e, se ja existe historico e o IP e novo, avisa o usuario por e-mail.
    try {
      const ua = (req.headers.get('user-agent') || '').slice(0, 300);
      const ipKnown = !!ip && ip !== 'unknown';
      let isNewDevice = false;
      if (ipKnown) {
        const [priorSameIp, priorAny] = await Promise.all([
          prisma.auditEntry.findFirst({ where: { actorId: user.id, action: 'auth.login.success', ip }, select: { id: true } }),
          prisma.auditEntry.findFirst({ where: { actorId: user.id, action: 'auth.login.success' }, select: { id: true } }),
        ]);
        // so alerta se ja ha baseline de login (priorAny) E este IP nunca foi visto.
        isNewDevice = !priorSameIp && !!priorAny;
      }
      await prisma.auditEntry.create({
        data: {
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'auth.login.success',
          entity: 'user',
          entityId: user.id,
          clientId: user.clientId ?? null,
          ip: ipKnown ? ip : null,
          userAgent: ua || null,
          details: JSON.stringify({ newDevice: isNewDevice }),
        },
      });
      if (isNewDevice && user.email) {
        const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
        const uaSafe = ua.replace(/[<>]/g, '');
        void sendEmail({
          to: user.email,
          subject: 'GodManager — novo acesso à sua conta',
          html: `<p>Detectámos um acesso à sua conta GodManager a partir de um dispositivo ou local novo.</p>`
            + `<p><b>Quando:</b> ${when}<br/><b>IP:</b> ${ip}<br/><b>Dispositivo:</b> ${uaSafe}</p>`
            + `<p>Se foi você, pode ignorar este aviso. Se não reconhece este acesso, troque a sua senha imediatamente e ative a verificação em duas etapas (2FA) nas configurações.</p>`,
          text: `Novo acesso à sua conta GodManager. Quando: ${when}. IP: ${ip}. Dispositivo: ${ua}. Se não foi você, troque a senha e ative o 2FA.`,
        }).catch(() => {});
      }
    } catch {
      /* nunca impacta o login */
    }

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
