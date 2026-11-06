import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUnreadNotificationCount,
  useUnreadNotifications,
  type NotificationData,
} from '../api/notifications.api';
import { describeNotification, formatRelativeTime } from '../lib/notification-labels';

interface NotificationsBellProps {
  /** Controlado pelo casco (a gaveta "Mais" do celular abre o painel). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Sino do cabeçalho (D-24): contador, lista de não lidas, marcar lida / todas. */
export function NotificationsBell({ open: openProp, onOpenChange }: NotificationsBellProps = {}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  function setOpen(next: boolean) {
    if (openProp === undefined) setOpenInterno(next);
    onOpenChange?.(next);
  }
  const navigate = useNavigate();
  const { data: countData } = useUnreadNotificationCount();
  const { data: listData, loading } = useUnreadNotifications(open);
  const [markRead] = useMarkNotificationRead();
  const [markAll, { loading: markingAll }] = useMarkAllNotificationsRead();

  const count = countData?.unreadNotificationCount ?? 0;
  const items = listData?.notifications ?? [];

  async function handleClick(n: NotificationData) {
    const { href } = describeNotification(n);
    await markRead({ variables: { input: { id: n.id } } });
    setOpen(false);
    if (href) navigate(href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificações"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span
              data-testid="notifications-badge"
              className="absolute right-1 top-1 min-w-[18px] rounded-md bg-primary px-1 text-center text-[10px] font-semibold leading-[18px] tabular-nums text-white"
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-neutral-200 px-md py-sm">
          <h2 className="font-serif text-headline-sm text-neutral-800">Notificações</h2>
          <button
            type="button"
            disabled={count === 0 || markingAll}
            onClick={() => void markAll()}
            className="text-xs font-medium text-primary-700 hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
          >
            Marcar todas como lidas
          </button>
        </div>
        {items.length === 0 ? (
          <p className="px-md py-lg text-center text-sm text-neutral-500">
            {loading ? 'Carregando…' : 'Nenhuma notificação nova'}
          </p>
        ) : (
          <ul role="list" className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
            {items.map((n) => {
              const v = describeNotification(n);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleClick(n)}
                    className="flex w-full flex-col gap-0.5 px-md py-sm text-left hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none"
                  >
                    <span className="text-sm font-medium text-neutral-800">{v.title}</span>
                    {v.message && <span className="text-xs text-neutral-600">{v.message}</span>}
                    <span className="text-[11px] text-neutral-500">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
