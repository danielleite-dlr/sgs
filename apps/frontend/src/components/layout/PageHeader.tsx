import type { ReactNode } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; to?: string }>; // last item is current page
  cta?: ReactNode;
  /** Rótulo curto acima do título (ex.: "Painel do dia"). Sem maiúsculas forçadas (D-13). */
  eyebrow?: string;
  /** Linha abaixo do título (ex.: data por extenso). */
  description?: ReactNode;
  /** `display`: título de painel em Inter semibold, 28 px no celular e 36 px no computador. */
  variant?: 'default' | 'display';
}

export function PageHeader({
  title,
  breadcrumbs,
  cta,
  eyebrow,
  description,
  variant = 'default',
}: PageHeaderProps) {
  const h1 = (
    <h1
      className={cn(
        'min-w-0 break-words',
        variant === 'display'
          ? 'font-sans text-display font-semibold text-neutral-900 lg:text-display-lg'
          : 'font-serif text-headline-lg text-neutral-800',
      )}
    >
      {title}
    </h1>
  );
  // Sem descrição, o h1 continua filho direto da linha título/ações (HTML igual ao de antes).
  const heading = description ? (
    <div className="min-w-0">
      {h1}
      <p className="mt-xs text-body text-neutral-500 tabular-nums">{description}</p>
    </div>
  ) : (
    h1
  );

  return (
    <header className="pb-lg">
      {breadcrumbs && breadcrumbs.length > 0 && (
        // D-13: a trilha leva nomes de pessoa e de grupo, então nada de maiúsculas forçadas.
        <Breadcrumb className="mb-xs">
          <BreadcrumbList className="gap-1.5 text-[12px] leading-4 sm:gap-1.5">
            {breadcrumbs.map((b, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <BreadcrumbItem key={i}>
                  {!isLast && b.to ? (
                    <BreadcrumbLink asChild>
                      <Link
                        to={b.to}
                        className="text-[12px] font-medium leading-4 text-neutral-500 hover:text-neutral-800"
                      >
                        {b.label}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="text-[12px] font-semibold leading-4 text-neutral-800">
                      {b.label}
                    </BreadcrumbPage>
                  )}
                  {/* Separador em <span>: um <li> aqui ficaria dentro do <li> do item
                      (HTML inválido, UX-10). Mesmo visual do BreadcrumbSeparator. */}
                  {!isLast && (
                    <span
                      role="presentation"
                      aria-hidden="true"
                      className="text-neutral-500 [&>svg]:h-3.5 [&>svg]:w-3.5"
                    >
                      <ChevronRight />
                    </span>
                  )}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      {eyebrow && <p className="mb-xs text-overline text-neutral-500">{eyebrow}</p>}
      <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
        {heading}
        {cta && <div className="flex flex-wrap items-center gap-sm">{cta}</div>}
      </div>
    </header>
  );
}
