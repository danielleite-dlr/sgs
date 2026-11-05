import { useCallback, useEffect, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { ContractPreviewPdfQuery, type ContractPreviewPdfResult } from '../api/contracts.api';
import { contractErrorMessage } from './contract-labels';
import { base64ToBlob } from './contract-preview';

export const PREVIEW_DEBOUNCE_MS = 1000;

export interface ContractPreviewState {
  /** blob: do último PDF gerado (continua valendo enquanto o próximo é gerado). */
  url: string | null;
  loading: boolean;
  error: string;
  /** Gera agora; devolve o blob URL novo (null se falhou ou foi superada por outra). */
  generate: () => Promise<string | null>;
}

/**
 * Prévia em PDF do formulário de contrato. `auto` = regera ~1 s depois da última
 * mudança do input. Só a resposta mais recente é aplicada; o blob anterior é revogado.
 * Não registra nada do input nem do PDF (dados pessoais).
 */
export function useContractPreview(
  input: Record<string, unknown> | null,
  opts: { auto: boolean; delayMs?: number },
): ContractPreviewState {
  const client = useApolloClient();
  const key = input ? JSON.stringify(input) : null;
  const delayMs = opts.delayMs ?? PREVIEW_DEBOUNCE_MS;
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const keyRef = useRef(key);
  const seqRef = useRef(0);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const generate = useCallback(async (): Promise<string | null> => {
    const k = keyRef.current;
    if (!k) return null;
    const id = ++seqRef.current;
    setLoading(true);
    try {
      const res = await client.query<ContractPreviewPdfResult>({
        query: ContractPreviewPdfQuery,
        variables: { input: JSON.parse(k) as Record<string, unknown> },
        fetchPolicy: 'no-cache',
      });
      if (id !== seqRef.current) return null;
      const p = res.data.contractPreviewPdf;
      if (p.errors.length > 0 || !p.base64) {
        setError(
          p.errors[0] ? contractErrorMessage(p.errors[0]) : 'Não foi possível gerar a prévia.',
        );
        return null;
      }
      const next = URL.createObjectURL(base64ToBlob(p.base64, 'application/pdf'));
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = next;
      setUrl(next);
      setError('');
      return next;
    } catch {
      if (id === seqRef.current) setError('Não foi possível gerar a prévia. Tente novamente.');
      return null;
    } finally {
      if (id === seqRef.current) setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!opts.auto || !key) return;
    const t = setTimeout(() => void generate(), delayMs);
    return () => clearTimeout(t);
  }, [opts.auto, key, delayMs, generate]);

  useEffect(() => {
    const seq = seqRef;
    const blob = urlRef;
    return () => {
      seq.current++;
      if (blob.current) URL.revokeObjectURL(blob.current);
      blob.current = null;
    };
  }, []);

  return { url, loading, error, generate };
}
