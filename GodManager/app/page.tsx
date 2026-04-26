import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default function HomePage() {
  const c = cookies().get('NEXT_LOCALE')?.value;
  const locale =
    c && (routing.locales as readonly string[]).includes(c) ? c : routing.defaultLocale;
  redirect(`/${locale}/login`);
}
