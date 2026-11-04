import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCpf, validateCpf } from '@/features/clients/utils/cpf';
import {
  acceptPublicContract,
  fetchPublicContract,
  publicContractPdfUrl,
  PublicContractError,
  type PublicContract,
} from '../api/public-contract.api';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; contract: PublicContract };

const INVALID_LINK = 'Este link é inválido ou expirou. Peça um novo link ao estúdio.';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Página pública de aceite do contrato (/aceite/:orgId/:token), sem AppShell, Apollo ou auth.
 * O texto é exibido como texto puro (whitespace-pre-wrap), nunca como HTML.
 */
export function ContractAcceptPage() {
  const { orgId = '', token = '' } = useParams<{ orgId: string; token: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchPublicContract(orgId, token)
      .then((contract) => {
        if (cancelled) return;
        if (contract.accepted) setAcceptedAt(contract.acceptedAt);
        setState({ kind: 'ready', contract });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof PublicContractError && e.status === 404) {
          setState({ kind: 'invalid' });
        } else if (e instanceof PublicContractError && e.status === 429) {
          setState({ kind: 'error', message: 'Muitas tentativas. Aguarde um minuto.' });
        } else {
          setState({ kind: 'error', message: 'Não foi possível carregar o contrato. Tente novamente.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, token]);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  const valid = fullName.trim().length >= 3 && validateCpf(cpf) && agreed;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state.kind !== 'ready' || !valid || submitting) return;
    setSubmitting(true);
    setFormError(null);
    setStatus('Enviando aceite…');
    try {
      const r = await acceptPublicContract(orgId, token, {
        fullName: fullName.trim(),
        cpf,
        accepted: true,
        textSha256: state.contract.textSha256,
      });
      setAcceptedAt(r.acceptedAt);
      setState({ kind: 'ready', contract: { ...state.contract, accepted: true } });
      setStatus('Contrato aceito com sucesso.');
    } catch (err) {
      setStatus('');
      if (err instanceof PublicContractError) {
        if (err.status === 409 && err.code === 'TEXT_CHANGED') {
          setFormError('O contrato foi atualizado. Recarregue a página para ler a nova versão.');
        } else if (err.status === 409 && err.code === 'ALREADY_ACCEPTED') {
          setAcceptedAt(new Date().toISOString());
          setState({ kind: 'ready', contract: { ...state.contract, accepted: true } });
        } else if (err.status === 429) {
          setFormError('Muitas tentativas. Aguarde um minuto.');
        } else if (err.status === 404) {
          setState({ kind: 'invalid' });
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Não foi possível enviar o aceite. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-lg" data-org-id={orgId}>
      <div aria-live="polite" role="status" className="sr-only">
        {status}
      </div>

      {state.kind === 'loading' && (
        <>
          <h1 className="pb-lg text-2xl font-semibold text-neutral-800">Contrato</h1>
          <Skeleton className="h-40 w-full" />
        </>
      )}

      {state.kind === 'invalid' && (
        <>
          <h1 className="pb-lg text-2xl font-semibold text-neutral-800">Contrato</h1>
          <p role="alert" className="text-neutral-700">
            {INVALID_LINK}
          </p>
        </>
      )}

      {state.kind === 'error' && (
        <>
          <h1 className="pb-lg text-2xl font-semibold text-neutral-800">Contrato</h1>
          <p role="alert" className="text-danger-700">
            {state.message}
          </p>
        </>
      )}

      {state.kind === 'ready' && (
        <>
          <header className="pb-md">
            <p className="text-sm text-neutral-600">{state.contract.orgName}</p>
            <h1 className="text-2xl font-semibold text-neutral-800">
              Contrato {state.contract.code}
            </h1>
          </header>

          <article
            aria-label="Texto do contrato"
            className="whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-md text-sm text-neutral-800"
          >
            {state.contract.text}
          </article>

          {state.contract.accepted ? (
            <section className="pt-lg" aria-label="Contrato aceito">
              <p className="text-lg font-medium text-neutral-800">
                Contrato aceito{acceptedAt ? ` em ${formatWhen(acceptedAt)}` : ''}
              </p>
              <Button asChild className="mt-md">
                <a href={publicContractPdfUrl(orgId, token)} download>
                  Baixar PDF
                </a>
              </Button>
            </section>
          ) : (
            <form onSubmit={onSubmit} className="space-y-md pt-lg" noValidate>
              <div className="space-y-xs">
                <Label htmlFor="accept-name">Nome completo</Label>
                <Input
                  id="accept-name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-xs">
                <Label htmlFor="accept-cpf">CPF</Label>
                <Input
                  id="accept-cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  aria-invalid={cpf.length === 14 && !validateCpf(cpf)}
                />
                {cpf.length === 14 && !validateCpf(cpf) && (
                  <p className="text-sm text-danger-700">CPF inválido.</p>
                )}
              </div>
              <div className="flex items-start gap-sm">
                <input
                  id="accept-terms"
                  type="checkbox"
                  className="mt-1"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <Label htmlFor="accept-terms">Li e aceito os termos deste contrato</Label>
              </div>
              {formError && (
                <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-danger-700">
                  {formError}
                </p>
              )}
              <Button type="submit" disabled={!valid || submitting}>
                Aceito
              </Button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
