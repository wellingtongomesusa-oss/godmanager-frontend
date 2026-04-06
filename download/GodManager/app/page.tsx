import { redirect } from 'next/navigation';

/**
 * Raiz do app: envia direto para o dashboard estático em public/.
 * Evita iframe (muitas vezes fica branco por políticas do browser / tamanho / CSP).
 */
export default function HomePage() {
  redirect('/manager-pro-dashboard.html');
}
