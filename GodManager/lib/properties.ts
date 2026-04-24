export interface PropertyDTO {
  id: string;
  code: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  unitType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rent: string;
  deposit: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  mgmtFeePct: string;
  status: string;
  notes: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

async function j(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function listProperties(): Promise<PropertyDTO[]> {
  try {
    const res = await fetch('/api/properties', { credentials: 'include', cache: 'no-store' });
    const data = await j(res);
    if (!res.ok || !data?.ok) return [];
    return (data.properties || []) as PropertyDTO[];
  } catch {
    return [];
  }
}

export async function getPropertyById(id: string): Promise<PropertyDTO | null> {
  try {
    const res = await fetch(`/api/properties/${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' });
    const data = await j(res);
    if (!res.ok || !data?.ok) return null;
    return data.property as PropertyDTO;
  } catch {
    return null;
  }
}

export async function createProperty(
  input: Partial<PropertyDTO> & { code: string; address: string },
): Promise<{ ok: true; property: PropertyDTO } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Failed to create' };
    return { ok: true, property: data.property };
  } catch (e) {
    console.error('[createProperty]', e);
    return { ok: false, error: 'Network error' };
  }
}

export async function updateProperty(
  id: string,
  patch: Partial<PropertyDTO>,
): Promise<{ ok: true; property: PropertyDTO } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Failed to update' };
    return { ok: true, property: data.property };
  } catch (e) {
    console.error('[updateProperty]', e);
    return { ok: false, error: 'Network error' };
  }
}

export async function deleteProperty(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Failed to delete' };
    return { ok: true };
  } catch (e) {
    console.error('[deleteProperty]', e);
    return { ok: false, error: 'Network error' };
  }
}

/** Helper para bulk import (Bloco 2) */
export async function createPropertiesBulk(
  properties: Array<Partial<PropertyDTO> & { code: string; address: string }>,
): Promise<{ created: number; skipped: number; errors: Array<{ code: string; error: string }> }> {
  let created = 0;
  let skipped = 0;
  const errors: Array<{ code: string; error: string }> = [];
  for (const p of properties) {
    const res = await createProperty(p);
    if (res.ok) created++;
    else if (res.error === 'code already exists') skipped++;
    else errors.push({ code: p.code, error: res.error });
  }
  return { created, skipped, errors };
}
