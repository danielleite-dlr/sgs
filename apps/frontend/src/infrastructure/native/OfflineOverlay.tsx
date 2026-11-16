import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isNativeApp } from './platform';

/**
 * Tela "Sem conexão" para a queda de rede no meio da sessão (o errorPath local do app só cobre
 * a abertura/recarga). Só aparece dentro do app; no navegador comum não renderiza nada.
 */
export function OfflineOverlay() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!isNativeApp() || online) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sgs-offline-title"
      aria-describedby="sgs-offline-desc"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-md bg-[#F7F6F3] px-lg text-center safe-top safe-bottom"
    >
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary font-serif text-2xl font-semibold text-white"
      >
        GB
      </div>
      <h1 id="sgs-offline-title" className="font-serif text-headline-sm text-neutral-800">
        {t('native.offline.title')}
      </h1>
      <p id="sgs-offline-desc" className="max-w-xs text-neutral-500">
        {t('native.offline.description')}
      </p>
      <Button autoFocus onClick={() => window.location.reload()} className="h-12 min-w-[12rem]">
        {t('native.offline.retry')}
      </Button>
    </div>
  );
}
