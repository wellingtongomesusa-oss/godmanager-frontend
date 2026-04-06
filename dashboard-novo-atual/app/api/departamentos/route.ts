import { NextRequest, NextResponse } from 'next/server';
import {
  listDepartments,
  createDepartment,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from '@/services/departments.service';

/**
 * GET /api/departamentos
 * Lista todos os departamentos.
 */
export async function GET() {
  const depts = listDepartments();
  return NextResponse.json({ departamentos: depts });
}

/**
 * POST /api/departamentos
 * Cria um novo departamento.
 * Body: { name: string; description?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Campo "name" é obrigatório.' },
        { status: 400 }
      );
    }
    const dept = createDepartment({ name: name.trim(), description });
    return NextResponse.json(dept, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao criar departamento.' }, { status: 500 });
  }
}
