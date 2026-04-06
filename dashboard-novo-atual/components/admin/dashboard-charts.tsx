'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import type { ProjecaoMesItem, FaturamentoPoint, CategoriaItem } from '@/services/admin/admin-dashboard.service';

export function ChartProjecoesAtuais({ data }: { data: ProjecaoMesItem[] }) {
  const { t } = useLanguage();
  const maxVal = Math.max(...data.map((d) => d.atual + d.projecao), 1);
  return (
    <Card className="overflow-hidden border-0 bg-secondary-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/90">{t('chart.projecoes')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex h-48 items-end justify-between gap-1">
          {data.map((d) => {
            const totalBar = d.atual + d.projecao;
            const pct = Math.max((totalBar / maxVal) * 100, 10);
            const hAtual = totalBar ? (d.atual / totalBar) * 100 : 50;
            const hProj = totalBar ? (d.projecao / totalBar) * 100 : 50;
            return (
              <div key={d.month} className="flex flex-1 flex-col items-center gap-0.5">
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${pct}%`, minHeight: 28 }}>
                  <div className="min-h-[2px] w-full rounded-t bg-primary-400" style={{ height: `${hProj}%` }} />
                  <div className="min-h-[2px] w-full rounded-t bg-blue-500" style={{ height: `${hAtual}%` }} />
                </div>
                <span className="mt-1 text-[10px] font-medium text-white/70">{d.month}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-center gap-4 text-xs text-white/70">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded bg-blue-500" /> {t('chart.atual')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded bg-primary-400" /> {t('chart.projecao')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartFaturamento({ data, semanaAtual, semanaAnterior }: { data: FaturamentoPoint[]; semanaAtual: number; semanaAnterior: number }) {
  const { t } = useLanguage();
  const maxV = Math.max(...data.flatMap((d) => [d.atual, d.anterior]), 1);
  return (
    <Card className="border-secondary-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-secondary-800">{t('chart.faturamento')}</CardTitle>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />{t('chart.semanaAtual')}: R$ {semanaAtual.toLocaleString('pt-BR')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary-400" />{t('chart.semanaAnterior')}: R$ {semanaAnterior.toLocaleString('pt-BR')}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex h-32 items-end justify-between gap-2">
          {data.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center">
              <div className="flex w-full gap-0.5">
                <div className="flex-1 rounded-t bg-blue-500/80" style={{ height: `${(d.atual / maxV) * 100}px`, minHeight: 2 }} />
                <div className="flex-1 rounded-t bg-primary-400/80" style={{ height: `${(d.anterior / maxV) * 100}px`, minHeight: 2 }} />
              </div>
              <span className="mt-1 text-[10px] text-secondary-500">{d.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartCategorias({ data }: { data: CategoriaItem[] }) {
  const { t } = useLanguage();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const conic = data.map((d) => {
    const start = (acc / total) * 360;
    acc += d.value;
    const end = (acc / total) * 360;
    return `${d.color} ${start}deg ${end}deg`;
  }).join(', ');
  return (
    <Card className="border-secondary-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-secondary-800">{t('chart.categorias')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-32 w-32 shrink-0 rounded-full border-[10px] border-secondary-100" style={{ background: `conic-gradient(${conic})` }} />
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: d.color }} />
                <span className="text-secondary-700">{d.name}</span>
                <span className="font-medium text-secondary-800">{d.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
