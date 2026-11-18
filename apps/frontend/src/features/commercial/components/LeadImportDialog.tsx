import { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ImportCommercialLeadsMutation,
  PreviewCommercialLeadImportMutation,
  type ImportPreview,
  type ImportResult,
} from '../api/intake.api';

export interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
}

const MAX_BYTES = 2_500_000;

type Step = 'file' | 'preview' | 'result';

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function resultText(r: ImportResult): string {
  const leads = `${r.createdLeads} ${plural(r.createdLeads, 'lead', 'leads')}`;
  const deals = `${r.createdDeals} ${plural(r.createdDeals, 'negócio criado', 'negócios criados')}`;
  const parts = `${r.assignedDeals} com responsável, ${r.unassignedDeals} sem`;
  const skipped = `${r.skipped} ${plural(r.skipped, 'ignorado', 'ignorados')}`;
  return `${leads} e ${deals} (${parts}), ${skipped}`;
}

export function LeadImportDialog({ open, onOpenChange, onImported }: LeadImportDialogProps) {
  const [preview, previewState] = useMutation<{ previewCommercialLeadImport: ImportPreview }>(
    PreviewCommercialLeadImportMutation,
  );
  const [runImport, importState] = useMutation<{ importCommercialLeads: ImportResult }>(
    ImportCommercialLeadsMutation,
  );
  const [step, setStep] = useState<Step>('file');
  const [file, setFile] = useState<{ base64: string; filename: string } | null>(null);
  const [data, setData] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('file');
      setFile(null);
      setData(null);
      setResult(null);
      setError('');
    }
  }, [open]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError('');
    if (!/\.(xlsx|csv)$/i.test(f.name)) {
      setError('Use um arquivo .xlsx ou .csv');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('Arquivo maior que 2,5 MB');
      return;
    }
    try {
      const base64 = await readBase64(f);
      const res = await preview({ variables: { base64, filename: f.name } });
      const p = res.data?.previewCommercialLeadImport;
      if (!p) throw new Error('empty');
      setFile({ base64, filename: f.name });
      setData(p);
      setStep('preview');
    } catch {
      setError('Não foi possível ler a planilha. Tente novamente.');
    }
  }

  async function onConfirm() {
    if (!file) return;
    setError('');
    try {
      const res = await runImport({ variables: { base64: file.base64, filename: file.filename } });
      const r = res.data?.importCommercialLeads;
      if (!r) throw new Error('empty');
      if (r.errors.length) {
        setError(r.errors[0].message);
        return;
      }
      setResult(r);
      setStep('result');
      onImported?.(r.createdLeads);
    } catch {
      setError('Não foi possível importar. Tente novamente.');
    }
  }

  const withoutAssignee = data?.valid.filter((r) => !r.assignee).length ?? 0;
  const previewErrors = data?.errors ?? [];
  const canImport = !!data && data.valid.length > 0 && previewErrors.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar planilha de leads</DialogTitle>
          <DialogDescription>
            Colunas aceitas: Nome, Telefone, E-mail, Tipo (noiva/debutante), Data do evento,
            Origem, Observações, Responsável (e-mail ou nome do responsável no Atimos).
          </DialogDescription>
        </DialogHeader>

        {step === 'file' && (
          <div className="space-y-sm">
            <label htmlFor="lead-import-file" className="text-sm font-medium text-neutral-800">
              Arquivo .xlsx ou .csv (até 2,5 MB)
            </label>
            <input
              id="lead-import-file"
              type="file"
              accept=".xlsx,.csv"
              disabled={previewState.loading}
              onChange={(e) => void onFile(e.target.files?.[0])}
              className="block w-full text-sm"
            />
            {previewState.loading && <p role="status">Lendo planilha...</p>}
          </div>
        )}

        {step === 'preview' && data && (
          <div className="space-y-sm">
            <p className="text-sm font-medium text-neutral-800">
              {data.valid.length} {plural(data.valid.length, 'válida', 'válidas')}
              {' · '}
              {data.invalid.length} com problema
            </p>
            {withoutAssignee > 0 && (
              <p className="text-sm text-neutral-600">
                {withoutAssignee}{' '}
                {plural(withoutAssignee, 'linha sem responsável vai', 'linhas sem responsável vão')}{' '}
                para a fila de gerentes
              </p>
            )}
            {data.valid.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-md border border-neutral-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="p-xs">Linha</th>
                      <th className="p-xs">Nome</th>
                      <th className="p-xs">Telefone</th>
                      <th className="p-xs">Tipo</th>
                      <th className="p-xs">Responsável</th>
                      <th className="p-xs">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.valid.map((r) => (
                      <tr key={r.line} className="border-t border-neutral-100">
                        <td className="p-xs">{r.line}</td>
                        <td className="p-xs">{r.fullName}</td>
                        <td className="p-xs">{r.phone ?? '—'}</td>
                        <td className="p-xs">{r.kind ?? '—'}</td>
                        <td className="p-xs">
                          {r.assignee ? (
                            r.assignee.displayName
                          ) : (
                            <span>
                              Sem responsável
                              {r.assigneeWarning && (
                                <span role="status" className="block text-warning-700">
                                  {r.assigneeWarning}
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="p-xs">
                          {r.duplicateOf
                            ? r.duplicateOf.type === 'client'
                              ? `Já é cliente: ${r.duplicateOf.name}`
                              : `Lead existente: ${r.duplicateOf.name}`
                            : 'Novo'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.invalid.length > 0 && (
              <ul className="space-y-1 text-sm text-danger-700">
                {data.invalid.map((r) => (
                  <li key={r.line}>
                    Linha {r.line}: {r.reason}
                  </li>
                ))}
              </ul>
            )}
            {previewErrors.map((e) => (
              <p key={e.code + e.message} role="alert" className="text-sm text-danger-700">
                {e.message}
              </p>
            ))}
          </div>
        )}

        {step === 'result' && result && (
          <p role="status" className="text-sm text-neutral-800">
            {resultText(result)}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}

        <DialogFooter>
          {step === 'result' ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              {step === 'preview' && (
                <Button onClick={() => void onConfirm()} disabled={!canImport || importState.loading}>
                  Importar
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
