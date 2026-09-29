import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export interface TemporaryPasswordBoxProps {
  password: string;
}

/** Exibe a senha provisória uma única vez, com botão de copiar. */
export function TemporaryPasswordBox({ password }: TemporaryPasswordBoxProps) {
  const { t } = useTranslation();

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success(t('team.password.copied'));
    } catch {
      toast.error(t('team.password.copyFailed'));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <code
          data-testid="temporary-password"
          className="flex-1 select-all rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-base tracking-wide"
        >
          {password}
        </code>
        <Button type="button" variant="outline" onClick={() => void copy()}>
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('team.password.copy')}
        </Button>
      </div>
      <p className="text-sm text-neutral-600">{t('team.password.oneTimeNotice')}</p>
    </div>
  );
}
