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

export interface PageHeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; to?: string }>; // last item is current page
  cta?: ReactNode;
}

export function PageHeader({ title, breadcrumbs, cta }: PageHeaderProps) {
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
      <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
        <h1 className="min-w-0 break-words font-serif text-headline-lg text-neutral-800">
          {title}
        </h1>
        {cta && <div className="flex flex-wrap items-center gap-sm">{cta}</div>}
      </div>
    </header>
  );
}
