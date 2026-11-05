import { useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  ContractSettingsQuery,
  RemoveContractLetterheadMutation,
  UploadContractLetterheadMutation,
  type ContractLetterheadData,
  type RemoveContractLetterheadResult,
  type UploadContractLetterheadResult,
  type UserError,
} from '../api/contracts.api';
import { formatDateTime } from '../lib/contract-labels';

const MAX_BYTES = 2_621_440; // 2,5 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg'];

const LETTERHEAD_ERRORS: Record<string, string> = {
  LETTERHEAD_TYPE: 'Envie uma imagem PNG ou JPG.',
  LETTERHEAD_TOO_LARGE: 'Imagem maior que 2,5 MB.',
  LETTERHEAD_RATIO: 'A imagem deve ter proporção A4 (retrato).',
  LETTERHEAD_UNSUPPORTED: 'Formato de imagem não suportado (use PNG 8 bits ou JPG).',
  LETTERHEAD_INVALID: 'Não foi possível ler a imagem. Tente outro arquivo.',
};

function errorText(e: UserError): string {
  return LETTERHEAD_ERRORS[e.code] ?? e.message;
}

function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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

export function LetterheadUpload({ letterhead }: { letterhead: ContractLetterheadData | null }) {
  const [upload, { loading: uploading }] = useMutation<UploadContractLetterheadResult>(
    UploadContractLetterheadMutation,
    { refetchQueries: [{ query: ContractSettingsQuery }] },
  );
  const [remove, { loading: removing }] = useMutation<RemoveContractLetterheadResult>(
    RemoveContractLetterheadMutation,
    { refetchQueries: [{ query: ContractSettingsQuery }] },
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = uploading || removing;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setErrorMsg('');
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg(LETTERHEAD_ERRORS.LETTERHEAD_TYPE);
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrorMsg(LETTERHEAD_ERRORS.LETTERHEAD_TOO_LARGE);
      return;
    }
    try {
      const base64 = await readBase64(file);
      const res = await upload({
        variables: { input: { filename: file.name, mimeType: file.type, base64 } },
      });
      const errors = res.data?.uploadContractLetterhead.errors ?? [];
      if (errors.length) {
        setErrorMsg(errorText(errors[0]));
        return;
      }
      toast.success('Papel timbrado atualizado.');
    } catch {
      setErrorMsg('Não foi possível enviar o papel timbrado. Tente novamente.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onRemove() {
    setErrorMsg('');
    try {
      const res = await remove();
      const errors = res.data?.removeContractLetterhead.errors ?? [];
      if (errors.length) {
        setErrorMsg(errorText(errors[0]));
        return;
      }
      toast.success('Papel timbrado removido.');
    } catch {
      setErrorMsg('Não foi possível remover o papel timbrado. Tente novamente.');
    }
  }

  const label = letterhead ? 'Trocar papel timbrado' : 'Enviar papel timbrado';

  return (
    <Card data-testid="letterhead-upload">
      <CardHeader>
        <CardTitle className="text-base">Papel timbrado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-sm">
        {letterhead ? (
          <div className="space-y-xs text-sm text-neutral-800">
            <p className="font-semibold">{letterhead.originalFilename}</p>
            <p>
              {letterhead.width}×{letterhead.height} px · {formatKb(letterhead.sizeBytes)} · enviado
              em {formatDateTime(letterhead.uploadedAt)}
            </p>
            <p className="text-xs text-neutral-600">
              Para impressão, prefira 2480×3508 px (300 dpi).
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-600">
            Sem papel timbrado — o PDF sai sem fundo, com as mesmas margens.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-sm">
          <div>
            <Label htmlFor="letterhead-file" className="text-xs font-semibold text-neutral-700">
              {label}
            </Label>
            <input
              id="letterhead-file"
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              disabled={busy}
              className="mt-xs block text-sm"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
          {letterhead && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmOpen(true)}
            >
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-neutral-600">PNG ou JPG, proporção A4 retrato, até 2,5 MB.</p>
        {errorMsg && (
          <p role="alert" data-testid="letterhead-error" className="text-sm text-error-600">
            {errorMsg}
          </p>
        )}
      </CardContent>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o papel timbrado?</AlertDialogTitle>
            <AlertDialogDescription>
              Os próximos contratos saem sem fundo. Contratos já gerados não mudam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onRemove()}>
              Remover papel timbrado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
