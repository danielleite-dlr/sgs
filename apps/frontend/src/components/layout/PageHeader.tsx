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
        <Breadcrumb className="mb-sm">
          <BreadcrumbList>
            {breadcrumbs.map((b, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <BreadcrumbItem key={i}>
                  {!isLast && b.to ? (
                    <BreadcrumbLink asChild>
                      <Link to={b.to}>{b.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="font-semibold text-primary-700">
                      {b.label}
                    </BreadcrumbPage>
                  )}
                  {/* Separador em <span>: um <li> aqui ficaria dentro do <li> do item
                      (HTML inválido, UX-10). Mesmo visual do BreadcrumbSeparator. */}
                  {!isLast && (
                    <span
                      role="presentation"
                      aria-hidden="true"
                      className="[&>svg]:h-3.5 [&>svg]:w-3.5"
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-800">{title}</h1>
        {cta && <div>{cta}</div>}
      </div>
    </header>
  );
}
