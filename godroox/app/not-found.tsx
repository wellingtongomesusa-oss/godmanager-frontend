import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-secondary-900 mb-4">404</h1>
        <h2 className="heading-2 text-secondary-700 mb-4">Page Not Found</h2>
        <p className="body-large text-secondary-600 mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link href="/">
          <Button size="lg">Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
