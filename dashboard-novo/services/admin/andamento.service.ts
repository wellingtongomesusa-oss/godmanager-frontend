/**
 * Andamento do projeto – mock service.
 * Projetos com valor de entrada, valor da parcela e pagamentos (checkboxes).
 */

export interface Pagamento {
  id: string;
  label: string;
  pago: boolean;
}

export interface ProjetoAndamento {
  id: string;
  valorEntrada: number;
  valorParcela: number;
  pagamentos: Pagamento[];
  createdAt: string;
}

export type AddAndamentoInput = {
  valorEntrada: number;
  valorParcela: number;
  numParcelas: number;
};

let mockProjetos: ProjetoAndamento[] = [];

function generateId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getProjetos(): ProjetoAndamento[] {
  return [...mockProjetos];
}

export function addProjeto(input: AddAndamentoInput): ProjetoAndamento {
  const pagamentos: Pagamento[] = Array.from({ length: Math.max(1, input.numParcelas) }, (_, i) => ({
    id: `pag-${Date.now()}-${i}`,
    label: `Parcela ${i + 1}`,
    pago: false,
  }));
  const p: ProjetoAndamento = {
    id: generateId(),
    valorEntrada: input.valorEntrada,
    valorParcela: input.valorParcela,
    pagamentos,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  mockProjetos.unshift(p);
  return p;
}

export function togglePagamento(projetoId: string, pagamentoId: string): ProjetoAndamento | null {
  const idx = mockProjetos.findIndex((p) => p.id === projetoId);
  if (idx < 0) return null;
  const proj = mockProjetos[idx]!;
  const pag = proj.pagamentos.find((x) => x.id === pagamentoId);
  if (!pag) return null;
  const pagamentos = proj.pagamentos.map((p) =>
    p.id === pagamentoId ? { ...p, pago: !p.pago } : p
  );
  mockProjetos[idx] = { ...proj, pagamentos };
  return mockProjetos[idx]!;
}
