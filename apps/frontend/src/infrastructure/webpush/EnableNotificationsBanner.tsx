import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { isIosDevice, isWebPushContext } from './platform-ios';
import { enableWebPush, getWebPushState, type WebPushState } from './web-push-client';
import { fetchWebPushPublicKey } from './push-config.api';

const ADIADO_KEY = 'sgs-webpush-aviso-adiado';
const SETE_DIAS = 7 * 24 * 3600 * 1000;

function adiado(): boolean {
  try {
    const raw = window.localStorage.getItem(ADIADO_KEY);
    if (!raw) return false;
    const quando = Number(raw);
    return Number.isFinite(quando) && Date.now() - quando < SETE_DIAS;
  } catch {
    return false;
  }
}

function adiar() {
  try {
    window.localStorage.setItem(ADIADO_KEY, String(Date.now()));
  } catch {
    // sem armazenamento: a faixa só some até recarregar
  }
}

type Resultado = 'enabled' | 'error' | null;

export function EnableNotificationsBanner() {
  const { t } = useTranslation();
  const impersonating = useAuthStore((s) => s.impersonating);
  const eligible = !impersonating && isWebPushContext() && isIosDevice();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (!eligible || adiado()) return;
    let cancelado = false;
    void (async () => {
      const key = await fetchWebPushPublicKey();
      if (cancelado) return;
      setPublicKey(key);
      const s = await getWebPushState(key);
      if (!cancelado) setState(s);
    })();
    return () => {
      cancelado = true;
    };
  }, [eligible]);

  function onEnable() {
    if (!publicKey) return;
    setBusy(true);
    setResultado(null);
    void enableWebPush(publicKey)
      .then((r) => {
        if (r === 'granted') setResultado('enabled');
        else if (r === 'denied') setState('denied');
        else if (r === 'error') setResultado('error');
      })
      .catch(() => setResultado('error'))
      .finally(() => setBusy(false));
  }

  function dispensar() {
    adiar();
    setFechado(true);
  }

  if (!eligible || fechado || !publicKey) return null;

  if (resultado === 'enabled') {
    return (
      <section
        aria-label={t('pwa.notifications.title')}
        className="mb-md flex items-center justify-between gap-md rounded-md border border-primary-200 bg-primary-50 p-md"
      >
        <p role="status" className="text-body text-neutral-800">
          {t('pwa.notifications.enabled')}
        </p>
        <Button variant="ghost" className="h-11" onClick={dispensar}>
          {t('pwa.notifications.close')}
        </Button>
      </section>
    );
  }

  if (state === 'denied' || state === 'unsupported') {
    const denied = state === 'denied';
    return (
      <Alert variant="warning" className="mb-md space-y-xs">
        <AlertTitle>
          {denied ? t('pwa.notifications.deniedTitle') : t('pwa.notifications.unsupportedTitle')}
        </AlertTitle>
        <AlertDescription>
          {denied ? t('pwa.notifications.denied') : t('pwa.notifications.unsupported')}
        </AlertDescription>
        <Button variant="ghost" className="h-11" onClick={dispensar}>
          {t('pwa.notifications.close')}
        </Button>
      </Alert>
    );
  }

  if (state !== 'default' && state !== 'needs-subscribe') return null;

  return (
    <section
      aria-label={t('pwa.notifications.title')}
      className="mb-md rounded-md border border-primary-200 bg-primary-50 p-md"
    >
      <div className="flex items-start gap-sm">
        <BellRing size={20} className="mt-xs shrink-0 text-primary-500" aria-hidden="true" />
        <div className="space-y-xs">
          <p className="text-body font-semibold text-neutral-900">
            {t('pwa.notifications.title')}
          </p>
          <p className="text-body text-neutral-700">{t('pwa.notifications.body')}</p>
          {resultado === 'error' && (
            <p role="status" className="text-label text-error-700">
              {t('pwa.notifications.error')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-sm flex flex-wrap gap-xs">
        <Button className="h-11" disabled={busy} onClick={onEnable}>
          {busy ? t('pwa.notifications.enabling') : t('pwa.notifications.enable')}
        </Button>
        <Button variant="ghost" className="h-11" onClick={dispensar}>
          {t('pwa.notifications.later')}
        </Button>
      </div>
    </section>
  );
}
