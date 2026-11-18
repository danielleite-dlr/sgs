import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusSquare, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isIosSafari } from './platform-ios';

export function InstallIphoneDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const safari = isIosSafari();

  async function copyLink() {
    try {
      await navigator.clipboard?.writeText(window.location.origin + '/login');
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pwa.install.title')}</DialogTitle>
          <DialogDescription>{t('pwa.install.description')}</DialogDescription>
        </DialogHeader>

        {!safari && (
          <Alert variant="warning" className="space-y-xs">
            <AlertTitle>{t('pwa.install.notSafariTitle')}</AlertTitle>
            <AlertDescription>{t('pwa.install.notSafari')}</AlertDescription>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => void copyLink()}
            >
              {copied ? t('pwa.install.copied') : t('pwa.install.copyLink')}
            </Button>
          </Alert>
        )}

        <ol className="list-decimal space-y-xs pl-lg text-body text-neutral-800">
          <li>{t('pwa.install.step1')}</li>
          <li>
            <Share size={16} className="mr-xs inline" aria-hidden="true" />
            {t('pwa.install.step2')}
          </li>
          <li>
            <PlusSquare size={16} className="mr-xs inline" aria-hidden="true" />
            {t('pwa.install.step3')}
          </li>
          <li>{t('pwa.install.step4')}</li>
          <li>{t('pwa.install.step5')}</li>
        </ol>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" className="h-11 w-full">
              {t('pwa.install.close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
