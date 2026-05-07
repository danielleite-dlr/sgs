import { cn } from '@/lib/utils';
import { Folder, Scissors, Package as PkgIcon, ShoppingBag } from 'lucide-react';

export type EntityAvatarKind = 'category' | 'service' | 'product' | 'package' | 'client';

export function EntityAvatar({
  name,
  kind,
  imageUrl,
  className,
}: {
  name: string;
  kind: EntityAvatarKind;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn('h-10 w-10 rounded-md object-cover', className)}
      />
    );
  }

  // Strip non-letters, take first 2 chars uppercased
  const letters = name.replace(/[^A-Za-zÀ-ú]/g, '');
  const initials = letters.slice(0, 2).toUpperCase();
  const FallbackIcon =
    kind === 'service' ? Scissors :
    kind === 'product' ? ShoppingBag :
    kind === 'package' ? PkgIcon :
    Folder;

  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-sm font-semibold text-primary-700',
        className,
      )}
      aria-hidden="true"
    >
      {initials || <FallbackIcon className="h-5 w-5" />}
    </div>
  );
}
