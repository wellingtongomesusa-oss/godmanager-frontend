'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface CadastroItem {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
}

function formatPhoneForWhatsApp(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
  return withCountry;
}

function ContactButtons({ email, phone }: { email: string; phone: string | null }) {
  const wap = formatPhoneForWhatsApp(phone);
  const smsPhone = phone ? phone.replace(/\D/g, '') : '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`mailto:${email}`}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-secondary-700 transition-colors hover:bg-primary-500 hover:border-primary-500 hover:text-white"
        title="Enviar e-mail"
      >
        E-mail
      </a>
      {smsPhone && (
        <a
          href={`sms:${smsPhone}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-secondary-700 transition-colors hover:bg-emerald-600 hover:border-emerald-600 hover:text-white"
          title="Enviar SMS"
        >
          SMS
        </a>
      )}
      {wap && (
        <a
          href={`https://wa.me/${wap}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-secondary-700 transition-colors hover:bg-green-600 hover:border-green-600 hover:text-white"
          title="Abrir WhatsApp"
        >
          WhatsApp
        </a>
      )}
    </div>
  );
}

export function CadastrosSection() {
  const [usuarios, setUsuarios] = useState<CadastroItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/cadastros')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setUsuarios(data.usuarios ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setError('Erro ao carregar cadastros.'))
      .finally(() => setLoading(false));
  }, []);

  const roleLabel: Record<string, string> = {
    CUSTOMER: 'Cliente',
    PARTNER: 'Parceiro',
    ADMIN: 'Administrador',
  };

  return (
    <Card className="border-gray-200 bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-secondary-900">Usuários cadastrados (Frontend)</CardTitle>
        <CardDescription className="text-secondary-600">
          Cadastros do site Godroox. Use E-mail, SMS ou WhatsApp para falar com o cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent" />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-rose-50 py-3 text-center text-sm text-rose-600">
            {error}
          </p>
        )}
        {!loading && !error && (
          <>
            <p className="mb-4 text-sm text-secondary-600">Total: {total} cadastros</p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-secondary-700">Nome</th>
                    <th className="px-4 py-3 font-semibold text-secondary-700">E-mail</th>
                    <th className="px-4 py-3 font-semibold text-secondary-700">Telefone</th>
                    <th className="px-4 py-3 font-semibold text-secondary-700">Perfil</th>
                    <th className="px-4 py-3 font-semibold text-secondary-700">Data cadastro</th>
                    <th className="px-4 py-3 font-semibold text-secondary-700">Falar com cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-secondary-500">
                        Nenhum cadastro encontrado. Cadastros feitos no frontend (localhost:3000) aparecem aqui.
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-secondary-700">{u.name ?? '—'}</td>
                        <td className="px-4 py-3 text-secondary-700">{u.email}</td>
                        <td className="px-4 py-3 text-secondary-700">{u.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-secondary-700">{roleLabel[u.role] ?? u.role}</td>
                        <td className="px-4 py-3 text-secondary-700">
                          {new Date(u.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <ContactButtons email={u.email} phone={u.phone} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
