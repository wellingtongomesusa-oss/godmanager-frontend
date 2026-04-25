export interface TenantDTO {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  unit: string | null;
  propertyId: string | null;
  property?: { id: string; code: string; address: string } | null;
  moveIn: string | null;
  leaseTo: string | null;
  rent: string;
  deposit: string;
  tenantType: string | null;
  status: string;
  ssn: string | null;
  itin: string | null;
  tags: string[];
  notes: string | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

const BASE = '/api/tenants';

export async function listTenants(): Promise<TenantDTO[]> {
  const res = await fetch(BASE, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to list tenants');
  const data = await res.json();
  return data.tenants || [];
}

export async function getTenantById(id: string): Promise<TenantDTO | null> {
  const res = await fetch(`${BASE}/${id}`, { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.tenant || null;
}

export async function createTenant(payload: Partial<TenantDTO> & { code: string; name: string }): Promise<TenantDTO> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create tenant');
  const data = await res.json();
  return data.tenant;
}

export async function updateTenant(id: string, payload: Partial<TenantDTO>): Promise<TenantDTO> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update tenant');
  const data = await res.json();
  return data.tenant;
}

export async function deleteTenant(id: string): Promise<boolean> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.ok;
}
