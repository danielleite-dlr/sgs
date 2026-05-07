import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Floating support chat bubble — Trinks-style.
 *
 * Persistent on all authenticated pages, lower-right corner.
 * Sits above bottom nav on mobile (bottom-20), normal on desktop (bottom-6).
 */
export function ChatBubble() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bubble trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar chat de suporte' : 'Abrir chat de suporte'}
        className={cn(
          'fixed right-4 z-30 h-12 w-12 rounded-full bg-primary-500 text-white shadow-lg',
          'flex items-center justify-center hover:bg-primary-700 transition-colors',
          'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2',
          'bottom-20 lg:bottom-6',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat de suporte"
          className="fixed right-4 z-30 w-[320px] max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-200 bg-white shadow-xl bottom-36 lg:bottom-24"
        >
          <header className="flex items-center justify-between px-md py-sm border-b border-neutral-200 bg-primary-50">
            <div className="flex items-center gap-sm min-w-0">
              <div className="h-8 w-8 rounded-full bg-primary-500 text-white flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-neutral-800">Suporte SGS</span>
                <span className="text-xs text-success-600 flex items-center gap-xs">
                  <span className="inline-block h-2 w-2 rounded-full bg-success-500" />
                  Online
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="text-neutral-500 hover:text-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="px-md py-md text-sm text-neutral-700">
            <p className="mb-sm">Olá! Como podemos ajudar você hoje?</p>
            <p className="text-xs text-neutral-500">
              (Funcionalidade de chat ao vivo será conectada em breve.)
            </p>
          </div>
          <footer className="px-md py-sm border-t border-neutral-200">
            <input
              type="text"
              placeholder="Digite sua mensagem…"
              className="w-full rounded-md border border-neutral-200 px-sm py-xs text-sm outline-none focus:border-primary-500"
              disabled
            />
          </footer>
        </div>
      )}
    </>
  );
}
