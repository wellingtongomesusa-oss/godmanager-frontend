import { NewsPanelMasterOne } from '@/components/manager-pro/NewsPanelMasterOne';

/** Sem cache agressivo do Next — evita ficar preso em HTML/JS antigo do NEWS */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function NewsPage() {
  return <NewsPanelMasterOne />;
}
