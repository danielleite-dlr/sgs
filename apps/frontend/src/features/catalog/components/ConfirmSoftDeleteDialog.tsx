import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SoftDeleteEntityKind =
  | 'category'
  | 'service'
  | 'package'
  | 'product'
  | 'commission'
  | 'client';

export function ConfirmSoftDeleteDialog({
  trigger,
  entityName,
  entityKind,
  onConfirm,
}: {
  trigger: ReactNode;
  entityName: string;
  entityKind: SoftDeleteEntityKind;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const isClient = entityKind === 'client';

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isClient
              ? t('catalog.softDelete.client.title', { name: entityName })
              : t('catalog.softDelete.title', { name: entityName })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isClient
              ? t('catalog.softDelete.client.body', { name: entityName })
              : t('catalog.softDelete.body', { name: entityName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('catalog.softDelete.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={() => onConfirm()}
          >
            {isClient
              ? t('catalog.softDelete.client.confirm')
              : t('catalog.softDelete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
