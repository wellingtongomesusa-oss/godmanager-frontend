'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!usuario.trim() || !senha) {
      setError('Informe o usuário master e a senha master.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuario.trim(), senha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Usuário ou senha master inválidos.');
        return;
      }
      if (data?.ok) {
        localStorage.setItem('masterSession', '1');
        localStorage.setItem('user', JSON.stringify({ email: usuario, role: 'admin', name: 'Master' }));
        router.replace('/dashboard');
        return;
      }
      setError('Acesso negado.');
    } catch {
      setError('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-charcoal px-4">
      <Card className="w-full max-w-md border-gray-200 bg-white shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-2xl text-primary-500">Dashboard Godroox</CardTitle>
          <CardDescription className="text-secondary-600">
            Acesso restrito: use apenas usuário master e senha master.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="usuario" className="mb-2 block text-sm font-medium text-secondary-700">
                Usuário master
              </label>
              <input
                id="usuario"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Usuário master"
                className="flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-secondary-800 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="senha" className="mb-2 block text-sm font-medium text-secondary-700">
                Senha master
              </label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha master"
                className="flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-secondary-800 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" className="w-full bg-primary-500 hover:bg-primary-600" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar no Dashboard'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-secondary-500">
            Frontend e dashboard em localhost diferentes. Configure MASTER_USER e MASTER_PASSWORD no .env do dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
