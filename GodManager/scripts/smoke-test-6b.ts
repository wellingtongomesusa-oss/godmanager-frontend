/**
 * Smoke test 6B — Persistência metadata.photos via API
 * Run: npx tsx scripts/smoke-test-6b.ts
 *
 * Pré-requisito: servidor next.js a correr em localhost:3101
 */
import { prisma } from '@/lib/db';
import { createSessionCookie } from '@/lib/authServer';
import type { UserRole } from '@prisma/client';

const API = 'http://localhost:3101';

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function pickUser() {
  const demo = await prisma.user.findFirst({
    where: { email: 'demo@godmanager.us', status: 'active' as any },
  });
  if (demo) return demo;
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' as any, status: 'active' as any },
  });
  if (admin) return admin;
  const any = await prisma.user.findFirst({ where: { status: 'active' as any } });
  return any;
}

function buildCookieHeader(cookie: { name: string; value: string }) {
  return `${cookie.name}=${cookie.value}`;
}

async function jpost(path: string, body: unknown, cookie: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function jpatch(path: string, body: unknown, cookie: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function jget(path: string, cookie: string) {
  const res = await fetch(`${API}${path}`, { headers: { Cookie: cookie } });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function jdelete(path: string, cookie: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function presignUrl(propertyId: string, sizeBytes: number, cookie: string) {
  const r = await jpost(
    '/api/properties/photos/presigned-url',
    {
      propertyId,
      contentType: 'image/jpeg',
      sizeBytes,
      originalFilename: `f-${sizeBytes}.jpg`,
    },
    cookie
  );
  if (r.status !== 200 || !r.json?.ok) {
    throw new Error(`presign failed: ${r.status} ${JSON.stringify(r.json)}`);
  }
  return r.json as { uploadUrl: string; publicUrl: string; key: string };
}

async function main() {
  console.log('=== Smoke test 6B ===\n');

  const user = await pickUser();
  if (!user) {
    record('pick user', false, 'no active user found in DB');
    process.exit(1);
  }
  record('pick user', true, `${user.email} (role=${user.role})`);

  const cookie = createSessionCookie(user.id, user.role as UserRole);
  const cookieHeader = buildCookieHeader(cookie);

  const ts = Date.now();
  const code = `SMOKE_${ts}`;
  let createdId: string | null = null;
  const keys: string[] = [];

  try {
    // 1. Pedir 2 presigned URLs
    const p1 = await presignUrl(code, 1024, cookieHeader);
    const p2 = await presignUrl(code, 2048, cookieHeader);
    keys.push(p1.key, p2.key);
    record('presign x2', true, `${p1.key.slice(0, 40)}…, ${p2.key.slice(0, 40)}…`);

    // 2. POST property com 2 photos
    const postBody = {
      code,
      address: '123 Smoke Test Ave',
      rent: 1500,
      deposit: 1500,
      metadata: {
        source: 'smoke_test_6b',
        photos: [
          { publicUrl: p1.publicUrl, key: p1.key, name: 'foto1.jpg', type: 'image/jpeg', size: 1024, isPrimary: true },
          { publicUrl: p2.publicUrl, key: p2.key, name: 'foto2.jpg', type: 'image/jpeg', size: 2048, isPrimary: false },
        ],
        primaryPhotoIndex: 0,
      },
    };
    const post = await jpost('/api/properties', postBody, cookieHeader);
    if (post.status !== 200 || !post.json?.ok || !post.json.property?.id) {
      throw new Error(`POST failed: ${post.status} ${JSON.stringify(post.json)}`);
    }
    createdId = post.json.property.id;
    record('POST /api/properties', true, `id=${createdId}`);

    // 3. GET, verificar 2 photos persistidas
    const get1 = await jget('/api/properties', cookieHeader);
    const found1 = (get1.json?.properties || []).find((p: unknown) => (p as { code?: string }).code === code);
    const photos1 = ((found1 as { metadata?: { photos?: unknown[] } })?.metadata as { photos?: unknown[] })?.photos || [];
    if (photos1.length !== 2) {
      throw new Error(`GET expected 2 photos, got ${photos1.length}`);
    }
    record('GET persists 2 photos', true);

    // 4. PATCH com 1 photo nova
    const p3 = await presignUrl(code, 3000, cookieHeader);
    keys.push(p3.key);
    const patch = await jpatch(
      `/api/properties/${createdId}`,
      {
        metadata: {
          source: 'smoke_test_6b',
          photos: [
            { publicUrl: p3.publicUrl, key: p3.key, name: 'foto3.jpg', type: 'image/jpeg', size: 3000, isPrimary: true },
          ],
          primaryPhotoIndex: 0,
        },
      },
      cookieHeader
    );
    if (patch.status !== 200 || !patch.json?.ok) {
      throw new Error(`PATCH failed: ${patch.status} ${JSON.stringify(patch.json)}`);
    }
    record('PATCH replace photos', true);

    // 5. GET, deve ter 1 photo
    const get2 = await jget('/api/properties', cookieHeader);
    const found2 = (get2.json?.properties || []).find((p: unknown) => (p as { code?: string }).code === code);
    const photos2 = ((found2 as { metadata?: { photos?: unknown[] } })?.metadata as { photos?: unknown[] })?.photos || [];
    if (photos2.length !== 1 || photos2[0].key !== p3.key) {
      throw new Error(`GET after PATCH: expected 1 photo with key=${p3.key}, got ${JSON.stringify(photos2)}`);
    }
    record('GET after PATCH = 1 photo', true);

    // 6. PATCH defensivo com payload inválido
    const badPatch = await jpatch(
      `/api/properties/${createdId}`,
      {
        metadata: {
          photos: [
            { publicUrl: 'http://insecure.com/x', key: 'properties/x' }, // http
            { key: '../escape' }, // sem publicUrl
            { publicUrl: 'https://ok.com/y', key: 'jobs/y' }, // wrong prefix
            'not-an-object',
            {
              publicUrl: 'https://valid.com/z',
              key: 'properties/valid/z.jpg',
              name: 'z',
              type: 'image/jpeg',
              size: 100,
            },
          ],
        },
      },
      cookieHeader
    );
    if (badPatch.status !== 200) {
      throw new Error(`bad PATCH HTTP ${badPatch.status}`);
    }
    const get3 = await jget('/api/properties', cookieHeader);
    const found3 = (get3.json?.properties || []).find((p: unknown) => (p as { code?: string }).code === code);
    const photos3 = ((found3 as { metadata?: { photos?: unknown[] } })?.metadata as { photos?: unknown[] })?.photos || [];
    // Esperamos só 1 photo válida (a última, com https + properties/)
    if (photos3.length !== 1 || (photos3[0] as { key?: string }).key !== 'properties/valid/z.jpg') {
      record(
        'defensive normalization',
        false,
        `expected 1 valid photo, got ${photos3.length}: ${JSON.stringify(photos3)}`
      );
    } else {
      record('defensive normalization', true, 'filtered 4 invalid, kept 1 valid');
    }
  } catch (err: unknown) {
    record('test error', false, err instanceof Error ? err.message : String(err));
  } finally {
    // Cleanup: apagar todas as keys do R2 e a property
    for (const k of keys) {
      try {
        await jpost('/api/properties/photos/delete', { key: k }, cookieHeader);
      } catch {
        // best effort
      }
    }
    if (createdId) {
      try {
        await jdelete(`/api/properties/${createdId}`, cookieHeader);
        record('cleanup property', true);
      } catch (e: unknown) {
        record('cleanup property', false, e instanceof Error ? e.message : String(e));
      }
    }
    await prisma.$disconnect();
  }

  console.log('\n=== RESULTS ===');
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`PASS: ${pass} | FAIL: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
