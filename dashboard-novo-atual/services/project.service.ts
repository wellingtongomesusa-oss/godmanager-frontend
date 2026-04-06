/**
 * Project Service – dashboard-novo
 * Projeto em andamento: salvar, atualizar, cálculos (entrada + parcelas = total).
 */

export type ProjectStatus = 'Em andamento' | 'Pausado' | 'Concluído';

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  startDate: string;
  status: ProjectStatus;
  downPayment: number;
  monthlyPayment: number;
  numberOfInstallments: number;
  totalValue: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  clientId: string;
  clientName: string;
  startDate: string;
  status: ProjectStatus;
  downPayment: number;
  monthlyPayment: number;
  numberOfInstallments: number;
  notes: string;
}

const projects: Project[] = [];
const clients = [
  { id: 'c1', name: 'Acme Corp' },
  { id: 'c2', name: 'Global Solutions Inc' },
  { id: 'c3', name: 'Tech Ventures LLC' },
  { id: 'c4', name: 'Smith & Associates' },
  { id: 'c5', name: 'Johnson Holdings' },
];

function generateId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Calcula valor total: entrada + (pagamento mensal × número de parcelas).
 */
export function calculateTotals(downPayment: number, monthlyPayment: number, numberOfInstallments: number): number {
  return downPayment + monthlyPayment * Math.max(0, numberOfInstallments);
}

/**
 * Lista clientes para dropdown.
 */
export function getClients(): { id: string; name: string }[] {
  return [...clients];
}

/**
 * Salva novo projeto.
 */
export function saveProject(input: ProjectInput): Project {
  const totalValue = calculateTotals(input.downPayment, input.monthlyPayment, input.numberOfInstallments);
  const project: Project = {
    id: generateId(),
    name: input.name,
    clientId: input.clientId,
    clientName: input.clientName,
    startDate: input.startDate,
    status: input.status,
    downPayment: input.downPayment,
    monthlyPayment: input.monthlyPayment,
    numberOfInstallments: input.numberOfInstallments,
    totalValue,
    notes: input.notes,
    createdAt: now(),
    updatedAt: now(),
  };
  projects.push(project);
  return project;
}

/**
 * Atualiza projeto existente.
 */
export function updateProject(id: string, input: Partial<ProjectInput>): Project | null {
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const current = projects[idx]!;
  const downPayment = input.downPayment ?? current.downPayment;
  const monthlyPayment = input.monthlyPayment ?? current.monthlyPayment;
  const numberOfInstallments = input.numberOfInstallments ?? current.numberOfInstallments;
  const totalValue = calculateTotals(downPayment, monthlyPayment, numberOfInstallments);
  const updated: Project = {
    ...current,
    ...input,
    downPayment,
    monthlyPayment,
    numberOfInstallments,
    totalValue,
    updatedAt: now(),
  };
  projects[idx] = updated;
  return updated;
}

/**
 * Lista todos os projetos.
 */
export function listProjects(): Project[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Busca projeto por ID.
 */
export function getProject(id: string): Project | null {
  return projects.find((p) => p.id === id) ?? null;
}
