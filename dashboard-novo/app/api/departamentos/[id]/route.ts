import { NextRequest, NextResponse } from 'next/server';
import {
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from '@/services/departments.service';

interface Params {
  params: { id: string };
}

/**
 * GET /api/departamentos/[id]
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const dept = getDepartmentById(id);
  if (!dept) return NextResponse.json({ error: 'Departamento não encontrado.' }, { status: 404 });
  return NextResponse.json(dept);
}

/**
 * PATCH /api/departamentos/[id]
 * Body: { name?: string; description?: string }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updated = updateDepartment(id, {
    name: body.name,
    description: body.description,
  });
  if (!updated) return NextResponse.json({ error: 'Departamento não encontrado.' }, { status: 404 });
  return NextResponse.json(updated);
}

/**
 * DELETE /api/departamentos/[id]
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ok = deleteDepartment(id);
  if (!ok) return NextResponse.json({ error: 'Departamento não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
