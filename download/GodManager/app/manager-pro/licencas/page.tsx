import { redirect } from 'next/navigation';

/** Rota alternativa (PT) → mesmo módulo */
export default function LicencasRedirectPage() {
  redirect('/manager-pro/licenses');
}
