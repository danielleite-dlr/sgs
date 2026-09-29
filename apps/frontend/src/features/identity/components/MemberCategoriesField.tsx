import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { CategoriesQuery } from '@/features/catalog/api/categorias.api';
import type {
  CategoriesQueryResult,
  CategoryData,
} from '@/features/catalog/api/categorias.api';

export interface MemberCategoriesFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  idPrefix?: string;
}

/**
 * Multi-seleção das categorias que o profissional atende (topo + filhos
 * indentados). Reutilizada no cadastro e na edição de membros.
 */
export function MemberCategoriesField({
  value,
  onChange,
  error,
  idPrefix = 'member-category',
}: MemberCategoriesFieldProps) {
  const { t } = useTranslation();
  const { data, loading } = useQuery<CategoriesQueryResult>(CategoriesQuery);
  const categories = data?.categories ?? [];

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  }

  function renderItem(category: CategoryData, depth: number) {
    const inputId = `${idPrefix}-${category.id}`;
    return (
      <div
        key={category.id}
        className="flex items-center gap-2"
        style={{ paddingLeft: depth * 20 }}
      >
        <input
          type="checkbox"
          id={inputId}
          checked={value.includes(category.id)}
          onChange={(e) => toggle(category.id, e.target.checked)}
        />
        <Label htmlFor={inputId}>{category.name}</Label>
      </div>
    );
  }

  return (
    <div className="space-y-2" role="group" aria-label={t('team.categories.label')}>
      <Label>{t('team.categories.label')}</Label>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
        {loading && (
          <p className="text-sm text-neutral-500">{t('team.categories.loading')}</p>
        )}
        {!loading && categories.length === 0 && (
          <p className="text-sm text-neutral-500">{t('team.categories.empty')}</p>
        )}
        {categories.map((top) => (
          <div key={top.id} className="space-y-1">
            {renderItem(top, 0)}
            {(top.children ?? []).map((child) => renderItem(child, 1))}
          </div>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-error-500">{error}</p>}
    </div>
  );
}
