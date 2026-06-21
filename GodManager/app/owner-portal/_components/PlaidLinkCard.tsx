'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

const CONFIG_MSG = 'Integracao bancaria indisponivel no momento.';

interface PlaidStatus {
  linked: boolean;
  institutionName: string | null;
  accountMask: string | null;
}

interface Props {
  ownerId: string;
}

export default function PlaidLinkCard({ ownerId }: Props) {
  const [status, setStatus] = useState<PlaidStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configUnavailable, setConfigUnavailable] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const fetchStatus = useCallback(async () => {
    setError(null);
    setConfigUnavailable(false);
    try {
      const params = new URLSearchParams({
        linkType: 'OWNER',
        entityId: ownerId,
      });
      const res = await fetch(`/api/plaid/status?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Nao foi possivel verificar o status da conta.',
        );
        return;
      }
      setStatus({
        linked: Boolean(data.linked),
        institutionName:
          typeof data.institutionName === 'string' ? data.institutionName : null,
        accountMask:
          typeof data.accountMask === 'string' ? data.accountMask : null,
      });
    } catch {
      setError('Nao foi possivel verificar o status da conta.');
    }
  }, [ownerId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchStatus().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchStatus]);

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      setLinking(true);
      setError(null);
      setConfigUnavailable(false);
      try {
        const res = await fetch('/api/plaid/exchange', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            linkType: 'OWNER',
            entityId: ownerId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setConfigUnavailable(true);
          return;
        }
        if (!res.ok) {
          setError(
            typeof data?.error === 'string'
              ? data.error
              : 'Falha ao vincular conta.',
          );
          return;
        }
        setStatus({
          linked: true,
          institutionName:
            typeof data.institutionName === 'string'
              ? data.institutionName
              : null,
          accountMask:
            typeof data.accountMask === 'string' ? data.accountMask : null,
        });
      } catch {
        setError('Falha ao vincular conta.');
      } finally {
        setLinking(false);
        setLinkToken(null);
      }
    },
    [ownerId],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => {
      onPlaidSuccess(public_token);
    },
    onExit: () => {
      setLinkToken(null);
      setLinking(false);
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const handleLinkClick = async () => {
    setError(null);
    setConfigUnavailable(false);
    setLinking(true);
    try {
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkType: 'OWNER', entityId: ownerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setConfigUnavailable(true);
        setLinking(false);
        return;
      }
      if (!res.ok || !data?.linkToken) {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Nao foi possivel iniciar a vinculacao.',
        );
        setLinking(false);
        return;
      }
      setLinkToken(data.linkToken);
    } catch {
      setError('Nao foi possivel iniciar a vinculacao.');
      setLinking(false);
    }
  };

  const linkedLabel = (() => {
    if (!status?.linked) return null;
    const name = status.institutionName?.trim() || 'Banco';
    const mask = status.accountMask?.trim();
    return mask ? `${name} ••${mask}` : name;
  })();

  return (
    <div className="mb-6 rounded-lg border border-gm-border bg-gm-paper p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gm-ink-secondary">
            Conta bancaria
          </p>
          {loading ? (
            <p className="mt-1 text-sm text-gm-ink-secondary">Verificando...</p>
          ) : configUnavailable ? (
            <p className="mt-1 text-sm text-gm-ink-secondary">{CONFIG_MSG}</p>
          ) : status?.linked ? (
            <p className="mt-1 text-sm font-medium text-gm-ink">
              Banco vinculado: {linkedLabel}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gm-ink-secondary">
              Vincule sua conta para recebimentos e repasses.
            </p>
          )}
          {error ? (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          ) : null}
        </div>

        {!loading && !configUnavailable && !status?.linked ? (
          <button
            type="button"
            onClick={handleLinkClick}
            disabled={linking}
            className="shrink-0 rounded-md bg-gm-amber px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gm-amber-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {linking ? 'Abrindo...' : 'Vincular banco'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
