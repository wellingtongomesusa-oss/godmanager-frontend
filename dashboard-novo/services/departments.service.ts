/**
 * Serviço de departamentos – CRUD (mock).
 * Server: store em memória. Client: localStorage.
 * Integrar com backend real posteriormente.
 */

export interface Department {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'godcrm_departments';

/** Store em memória para uso no servidor (API) */
let serverStore: Department[] = [];

function loadDepartments(): Department[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return serverStore;
}

function saveDepartments(items: Department[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } else {
    serverStore = [...items];
  }
}

function generateId(): string {
  return `dept_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function listDepartments(): Department[] {
  return loadDepartments();
}

export function getDepartmentById(id: string): Department | undefined {
  return loadDepartments().find((d) => d.id === id);
}

export function createDepartment(data: { name: string; description?: string }): Department {
  const items = loadDepartments();
  const slug = slugify(data.name);
  const exists = items.some((d) => d.slug === slug);
  const finalSlug = exists ? `${slug}-${Date.now()}` : slug;
  const now = new Date().toISOString();
  const dept: Department = {
    id: generateId(),
    name: data.name.trim(),
    slug: finalSlug,
    description: data.description?.trim(),
    createdAt: now,
    updatedAt: now,
  };
  items.push(dept);
  saveDepartments(items);
  return dept;
}

export function updateDepartment(id: string, data: Partial<{ name: string; description: string }>): Department | null {
  const items = loadDepartments();
  const idx = items.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  if (data.name !== undefined) {
    items[idx].name = data.name.trim();
    items[idx].slug = slugify(data.name);
  }
  if (data.description !== undefined) items[idx].description = data.description.trim();
  items[idx].updatedAt = now;
  saveDepartments(items);
  return items[idx];
}

export function deleteDepartment(id: string): boolean {
  const items = loadDepartments();
  const filtered = items.filter((d) => d.id !== id);
  if (filtered.length === items.length) return false;
  saveDepartments(filtered);
  return true;
}
