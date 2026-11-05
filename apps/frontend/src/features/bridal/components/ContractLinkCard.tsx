import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ContractReadinessQuery,
  GenerateContractLinkMutation,
  type ContractMissingField,
  type ContractReadinessResult,
  type ContractData,
  type GenerateContractLinkResult,
} from '../api/contracts.api';
import { contractErrorMessage, formatDateTime } from '../lib/contract-labels';

function MissingAction({
  field,
  groupId,
  onEditContract,
}: {
  field: ContractMissingField;
  groupId: string;
  onEditContract?: () => void;
}) {
  const cls = 'underline text-primary';
  switch (field.target) {
    case 'client':
      return field.targetId ? (
        <Link className={cls} to={`/clientes/${field.targetId}/editar`}>
          Editar cliente
        </Link>
      ) : null;
    case 'group':
      return (
        <Link className={cls} to={`/noivas/${field.targetId ?? groupId}`}>
          Editar grupo
        </Link>
      );
    case 'settings':
      return (
        <Link className={cls} to="/contratos?aba=configuracoes">
          Abrir configurações
        </Link>
      );
    case 'contract':
      return onEditContract ? (
        <button type="button" className={cls} onClick={onEditContract}>
          Editar contrato
        </button>
      ) : null;
    default:
      return null;
  }
}

export function ContractLinkCard({
  contract,
  canWrite,
  onEditContract,
}: {
  contract: ContractData;
  canWrite: boolean;
  onEditContract?: () => void;
}) {
  const [generate, { loading }] = useMutation<GenerateContractLinkResult>(
    GenerateContractLinkMutation,
  );
  const [link, setLink] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const canGenerate =
    canWrite &&
    contract.status !== 'cancelled' &&
    (contract.acceptance == null || contract.needsAcceptance);
  const readiness = useQuery<ContractReadinessResult>(ContractReadinessQuery, {
    variables: { id: contract.id },
    skip: !canGenerate,
    fetchPolicy: 'cache-and-network',
  });
  const missing = readiness.data?.contractReadiness.missing ?? [];
  const blocked = readiness.data ? !readiness.data.contractReadiness.ready : false;

  async function onGenerate() {
    setError('');
    try {
      const res = await generate({ variables: { id: contract.id } });
      const payload = res.data?.generateContractLink;
      if (payload?.errors.length) {
        setError(contractErrorMessage(payload.errors[0]));
        return;
      }
      if (payload?.url) setLink({ url: payload.url, expiresAt: payload.expiresAt });
    } catch {
      setError('Não foi possível gerar o link. Tente novamente.');
    }
  }

  async function onCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success('Link copiado — envie à noiva pelo WhatsApp');
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  }

  const a = contract.acceptance;
  const accepted = a != null;
  const staleAcceptance = contract.needsAcceptance && contract.acceptedVersion != null;

  return (
    <Card data-testid="contract-link-card">
      <CardHeader className="pb-sm">
        <CardTitle className="text-base">Aceite da noiva</CardTitle>
      </CardHeader>
      <CardContent className="space-y-sm text-sm">
        {accepted ? (
          <p data-testid="acceptance-info" className="text-neutral-700">
            Aceito em {formatDateTime(a.acceptedAt)} por <strong>{a.acceptedName}</strong> · CPF{' '}
            {a.acceptedCpfMasked} · IP {a.ip} · versão {a.version}
          </p>
        ) : contract.status === 'draft' ? (
          <p className="text-neutral-700">Rascunho — gere o link para a noiva aceitar.</p>
        ) : (
          <p className="text-neutral-700">Aguardando aceite</p>
        )}

        {staleAcceptance && (
          <p role="status" className="text-warning-700">
            Contrato alterado depois do aceite — gere novo link.
          </p>
        )}

        {link && (
          <div className="space-y-xs">
            <Input
              readOnly
              aria-label="Link de aceite"
              data-testid="contract-link-url"
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex items-center gap-sm">
              <Button type="button" variant="outline" size="sm" onClick={() => void onCopy()}>
                Copiar link
              </Button>
              {link.expiresAt && (
                <span className="text-xs text-neutral-600">
                  Válido até {formatDateTime(link.expiresAt)}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-600">
              O link aparece só agora; se perder, gere outro.
            </p>
          </div>
        )}

        {!link && contract.linkExpiresAt && !accepted && (
          <p className="text-xs text-neutral-600">
            Último link válido até {formatDateTime(contract.linkExpiresAt)}.
          </p>
        )}

        {error && (
          <p role="alert" className="text-error-600">
            {error}
          </p>
        )}

        {canGenerate && blocked && (
          <div className="rounded-md bg-warning-50 p-sm" data-testid="contract-missing">
            <p className="font-semibold text-neutral-800">Para gerar o link falta:</p>
            <ul className="mt-xs space-y-xs">
              {missing.map((m) => (
                <li key={`${m.code}-${m.targetId ?? ''}`} className="flex flex-wrap gap-sm">
                  <span>{m.label}</span>
                  <MissingAction field={m} groupId={contract.groupId} onEditContract={onEditContract} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {canGenerate && (
          <Button
            type="button"
            size="sm"
            disabled={loading || blocked}
            data-testid="contract-generate-link"
            onClick={() => void onGenerate()}
          >
            Gerar link de aceite
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
