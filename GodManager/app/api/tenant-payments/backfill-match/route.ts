import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { tenantPaymentAndBatchWhere } from '@/lib/tenantPaymentScope';
import {
  countActiveTenantsAtDate,
  matchProperty,
  matchTenantByDate,
  similarity,
} from '@/lib/tenantPaymentMatcher';

export const dynamic = 'force-dynamic';

const CHUNK = 100;

export async function POST() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const scopeUser = toClientScopeUser(user);
  const tpWhere = tenantPaymentAndBatchWhere(scopeUser);

  await prisma.tenantPayment.updateMany({
    where: tpWhere,
    data: { propertyId: null, tenantId: null },
  });

  const payments = await prisma.tenantPayment.findMany({
    where: {
      ...tpWhere,
      OR: [{ propertyId: null }, { tenantId: null }],
    },
    select: {
      id: true,
      clientId: true,
      propertyAddress: true,
      payerName: true,
      paymentDate: true,
      propertyId: true,
      tenantId: true,
    },
  });

  const byClient = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = byClient.get(p.clientId) ?? [];
    list.push(p);
    byClient.set(p.clientId, list);
  }

  let totalProcessed = 0;
  let newPropertyMatches = 0;
  let newTenantMatches = 0;
  let stillUnmatched = 0;
  type SampleRow = {
    payerName: string;
    propertyAddress: string;
    candidatesCount: number;
    propertyMatched: boolean;
    matchedPropertyAddress: string | null;
    tenantsInProperty: string[];
    bestNameScore: number;
    activeTenantsAtDate: number;
  };
  const samplesWithProp: SampleRow[] = [];
  const samplesNoProp: SampleRow[] = [];

  const updates: { id: string; propertyId: string | null; tenantId: string | null }[] = [];

  for (const [clientId, pmtList] of byClient) {
    const [properties, tenants] = await Promise.all([
      prisma.property.findMany({
        where: { clientId },
        select: { id: true, address: true },
      }),
      prisma.tenant.findMany({
        where: { clientId },
        select: { id: true, name: true, propertyId: true, moveIn: true, leaseTo: true, status: true },
      }),
    ]);

    for (const p of pmtList) {
      totalProcessed++;
      const matchedProp = matchProperty(p.propertyAddress, properties);
      const newPropertyId = matchedProp ?? p.propertyId;
      const matchedT = matchTenantByDate(p.paymentDate, tenants, newPropertyId);
      const newTenantId = matchedT ?? p.tenantId;

      if (p.propertyId == null && newPropertyId != null) newPropertyMatches++;
      if (p.tenantId == null && newTenantId != null) newTenantMatches++;

      if (newTenantId == null) {
        stillUnmatched++;
        const matchedPropertyId = matchedProp;
        const candidatesCount = matchedPropertyId
          ? tenants.filter((t) => t.propertyId === matchedPropertyId).length
          : 0;

        const payerNorm = p.payerName.toLowerCase().trim();
        let bestNameScore = 0;
        for (const t of tenants) {
          const sc = similarity(payerNorm, t.name.toLowerCase().trim());
          if (sc > bestNameScore) bestNameScore = sc;
        }

        const matchedPropertyAddress = matchedProp
          ? properties.find((pr) => pr.id === matchedProp)?.address ?? null
          : null;

        const tenantsInProperty = matchedPropertyId
          ? tenants
              .filter((t) => t.propertyId === matchedPropertyId)
              .slice(0, 5)
              .map((t) => t.name)
          : [];

        const activeTenantsAtDate = countActiveTenantsAtDate(p.paymentDate, tenants, newPropertyId);

        const sample: SampleRow = {
          payerName: p.payerName,
          propertyAddress: p.propertyAddress,
          candidatesCount,
          propertyMatched: !!matchedPropertyId,
          matchedPropertyAddress,
          tenantsInProperty,
          bestNameScore,
          activeTenantsAtDate,
        };

        if (newPropertyId != null) {
          if (samplesWithProp.length < 5) samplesWithProp.push(sample);
        } else {
          if (samplesNoProp.length < 5) samplesNoProp.push(sample);
        }
      }

      if (newPropertyId !== p.propertyId || newTenantId !== p.tenantId) {
        updates.push({ id: p.id, propertyId: newPropertyId, tenantId: newTenantId });
      }
    }
  }

  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    await prisma.$transaction(
      slice.map((u) =>
        prisma.tenantPayment.update({
          where: { id: u.id },
          data: { propertyId: u.propertyId, tenantId: u.tenantId },
        }),
      ),
    );
  }

  const sampleUnmatched = [
    ...samplesWithProp,
    ...samplesNoProp.slice(0, Math.max(0, 5 - samplesWithProp.length)),
  ];

  let totalTenantsInClient = 0;
  let tenantsWithPropertyId = 0;
  let totalPropertiesInClient = 0;
  for (const clientId of byClient.keys()) {
    const [totalTenants, tenantsWithProperty, totalProperties] = await Promise.all([
      prisma.tenant.count({ where: { clientId } }),
      prisma.tenant.count({ where: { clientId, propertyId: { not: null } } }),
      prisma.property.count({ where: { clientId } }),
    ]);
    totalTenantsInClient += totalTenants;
    tenantsWithPropertyId += tenantsWithProperty;
    totalPropertiesInClient += totalProperties;
  }

  const debug = {
    totalTenantsInClient,
    tenantsWithPropertyId,
    tenantsWithoutPropertyId: totalTenantsInClient - tenantsWithPropertyId,
    totalPropertiesInClient,
  };

  return NextResponse.json({
    totalProcessed,
    newPropertyMatches,
    newTenantMatches,
    stillUnmatched,
    sampleUnmatched,
    debug,
  });
}
