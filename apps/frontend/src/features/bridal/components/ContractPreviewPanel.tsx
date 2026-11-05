import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ContractPreviewState } from '../lib/use-contract-preview';

export const PREVIEW_EMPTY_MESSAGE = 'Informe a cliente e a data do evento para gerar a prévia.';

/** Telas largas: o PDF da prévia ao lado do formulário. */
export function ContractPreviewPanel({
  preview,
  hasInput,
}: {
  preview: ContractPreviewState;
  hasInput: boolean;
}) {
  return (
    <section
      aria-label="Prévia do contrato"
      data-testid="contract-preview"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-200 bg-neutral-50"
    >
      <header className="flex items-center justify-between gap-sm border-b border-neutral-200 bg-white px-sm py-xs">
        <h3 className="text-sm font-semibold text-neutral-800">Prévia do contrato</h3>
        <div className="flex items-center gap-sm">
          <span
            aria-live="polite"
            data-testid="contract-preview-status"
            className="text-xs text-neutral-600"
          >
            {preview.loading ? 'Gerando prévia…' : ''}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasInput}
            onClick={() => void preview.generate()}
          >
            <RefreshCw className="mr-xs h-3.5 w-3.5" aria-hidden="true" />
            Atualizar prévia
          </Button>
        </div>
      </header>
      {hasInput && preview.error && (
        <p
          role="status"
          data-testid="contract-preview-error"
          className="border-b border-neutral-200 bg-white px-sm py-xs text-xs text-error-600"
        >
          {preview.error}
        </p>
      )}
      <div className="min-h-0 flex-1">
        {!hasInput ? (
          <p className="p-md text-sm text-neutral-600" data-testid="contract-preview-empty">
            {PREVIEW_EMPTY_MESSAGE}
          </p>
        ) : preview.url ? (
          <iframe
            title="Prévia do contrato"
            data-testid="contract-preview-frame"
            src={preview.url}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <p className="p-md text-sm text-neutral-600">
            {preview.loading || !preview.error ? 'Gerando prévia…' : ''}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Celular: gera sob demanda e abre o PDF numa nova aba (iframe de PDF no celular é
 * instável). A aba é aberta no clique para não cair no bloqueador de pop-up.
 */
export function ContractPreviewButton({
  preview,
  hasInput,
}: {
  preview: ContractPreviewState;
  hasInput: boolean;
}) {
  async function open() {
    const win = window.open('', '_blank');
    const url = await preview.generate();
    if (!url) {
      win?.close();
      return;
    }
    if (win) {
      win.location.href = url;
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'previa-contrato.pdf';
    a.click();
  }
  return (
    <Button
      type="button"
      variant="outline"
      disabled={!hasInput || preview.loading}
      data-testid="contract-preview-open"
      onClick={() => void open()}
    >
      {preview.loading ? 'Gerando prévia…' : 'Ver prévia'}
    </Button>
  );
}
