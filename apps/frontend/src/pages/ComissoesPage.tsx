import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { Percent, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, DataTableColumn } from '@/components/ui/data-table';
import { CommissionRuleForm } from '@/features/catalog/components/CommissionRuleForm';
import {
  CommissionRulesQuery,
  SoftDeleteCommissionRuleMutation,
  CommissionRuleData,
  CommissionScopeType,
} from '@/features/catalog/api/comissoes.api';

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

/**
 * Renders the human-readable scope label for a commission rule.
 * Shows the resolved entity names (e.g. "Profissional + Serviço — Ana / Corte feminino")
 */
function resolveRuleLabel(rule: CommissionRuleData): string {
  switch (rule.scopeType as CommissionScopeType) {
    case 'member_service':
      return `Profissional + Serviço — ${rule.member?.displayName ?? '—'} / ${rule.service?.name ?? '—'}`;
    case 'service':
      return `Serviço — ${rule.service?.name ?? '—'}`;
    case 'category':
      return `Categoria — ${rule.category?.name ?? '—'}`;
    case 'product':
      return `Produto — ${rule.product?.name ?? '—'}`;
    case 'default':
    default:
      return 'Padrão da organização';
  }
}

export function ComissoesPage() {
  const { t } = useTranslation();
  const { data, loading } = useQuery(CommissionRulesQuery);
  const [softDelete] = useMutation(SoftDeleteCommissionRuleMutation, {
    refetchQueries: [{ query: CommissionRulesQuery }],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CommissionRuleData | null>(null);

  useEffect(() => {
    document.title = t('pages.comissoes.tab');
  }, [t]);

  const rules: CommissionRuleData[] = data?.commissionRules ?? [];

  async function handleDelete(rule: CommissionRuleData) {
    const res = await softDelete({ variables: { input: { id: rule.id } } });
    const errors =
      (res.data as { softDeleteCommissionRule: { errors: Array<{ message: string }> } })
        ?.softDeleteCommissionRule?.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
    } else {
      toast.success('Regra desativada.');
    }
    setDeleteTarget(null);
  }

  type ComissaoColumnKey = 'rule' | 'kind' | 'value' | 'actions';

  const columns: DataTableColumn<CommissionRuleData, ComissaoColumnKey>[] = [
    {
      key: 'rule',
      header: t('catalog.comissao.table.rule', 'Regra'),
      cell: (row) => (
        <span className="font-medium text-neutral-800">{resolveRuleLabel(row)}</span>
      ),
    },
    {
      key: 'kind',
      header: t('catalog.comissao.table.kind', 'Tipo'),
      cell: (row) => (
        <span className="text-neutral-800">
          {row.kind === 'fixed'
            ? t('catalog.comissao.kind.fixed', 'Valor fixo (R$)')
            : t('catalog.comissao.kind.percentage', 'Percentual (%)')}
        </span>
      ),
    },
    {
      key: 'value',
      header: t('catalog.comissao.table.value', 'Valor'),
      cell: (row) => (
        <span className="font-semibold text-neutral-800">
          {row.kind === 'fixed' ? fmt(row.value) : `${row.value}%`}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('catalog.comissao.table.actions', 'Ações'),
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Ações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-error-500"
              onClick={() => setDeleteTarget(row)}
            >
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const emptyState = (
    <div className="flex flex-col items-center gap-3 text-center">
      <Percent className="h-12 w-12 text-neutral-500" />
      <p className="text-base font-semibold text-neutral-800">
        {t('catalog.comissao.empty.heading', 'Nenhuma regra de comissão')}
      </p>
      <p className="text-sm text-neutral-500">
        {t(
          'catalog.comissao.empty.body',
          'Configure como os profissionais são remunerados.',
        )}
      </p>
      <Button onClick={() => setCreateOpen(true)}>
        {t('catalog.comissao.empty.cta', 'Nova regra')}
      </Button>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t('pages.comissoes.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.comissoes.h1') },
        ]}
        cta={<Button onClick={() => setCreateOpen(true)}>{t('pages.comissoes.newCta')}</Button>}
      />

      <DataTable
        columns={columns}
        rows={rules}
        rowKey={(r) => r.id}
        loading={loading}
        empty={emptyState}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova regra de comissão</DialogTitle>
          </DialogHeader>
          <CommissionRuleForm onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desativar regra?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta regra de comissão ficará inativa. O histórico e os relatórios serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error-500 hover:bg-error-500/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
