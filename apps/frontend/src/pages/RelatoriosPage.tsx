import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  to?: string;
}

const FINANCEIRO_REPORTS: ReportCard[] = [
  { id: 'dash',          title: 'Dashboard',                     description: '' },
  { id: 'fluxo-atend',   title: 'Fluxo Financeiro por forma de pagamento',
    description: 'Por data de atendimento/venda - Bruto e Líquido (já com os descontos de cada operadora) - Qualquer dia ou período' },
  { id: 'fluxo-pgto',    title: 'Fluxo Financeiro por forma de pagamento',
    description: 'Por data de pagamento/estorno - Bruto e Líquido (já com os descontos de cada operadora) - Qualquer dia ou período' },
  { id: 'fluxo-prev',    title: 'Fluxo Financeiro por forma de pagamento',
    description: 'Por data prevista de recebimento - Bruto e Líquido (já com os descontos de cada operadora) - Qualquer dia ou período' },
  { id: 'caixa',         title: 'Relatório de Abertura e Fechamento de Caixa',
    description: 'Qualquer período ou dia' },
  { id: 'pacotes',       title: 'Relatório Financeiro - Apenas Pacotes',
    description: 'Qualquer período ou dia' },
  { id: 'produtos',      title: 'Relatório Financeiro - Apenas Produtos',
    description: 'Qualquer período ou dia' },
  { id: 'servicos',      title: 'Relatório Financeiro - Apenas Serviços',
    description: 'Qualquer período ou dia' },
  { id: 'estornadas',    title: 'Relatório Financeiro - Exibindo as Contas Estornadas',
    description: 'Qualquer período ou dia' },
  { id: 'rel-atend',     title: 'Relatório Financeiro - Por data de Atendimento/Venda',
    description: 'Qualquer período ou dia' },
  { id: 'rel-pgto',      title: 'Relatório Financeiro - Por data de Pagamento/Estorno',
    description: 'Qualquer período ou dia' },
  { id: 'rel-tipo',      title: 'Relatório Financeiro - Por tipo de desconto',
    description: 'Qualquer período ou dia' },
  { id: 'venda-spp',     title: 'Relatório Financeiro - Venda de Serviços, Produtos e Pacotes',
    description: 'Qualquer período ou dia' },
  { id: 'fluxo-cdd',     title: 'Relatório Financeiro por forma de pagamento',
    description: 'Crédito, Débito, Dinheiro, Pré-pago, Outros - Qualquer período ou dia' },
  { id: 'ticket',        title: 'Ticket Médio do Estabelecimento',
    description: 'Com venda de serviços, produtos e pacotes - Qualquer período ou dia' },
];

const CATEGORIES = ['Financeiro', 'Atendimento', 'Cliente', 'Produto', 'Profissional'];

export function RelatoriosPage() {
  const [category, setCategory] = useState('Financeiro');

  return (
    <>
      <PageHeader
        title="Relatórios Principais"
        breadcrumbs={[{ label: 'Relatórios' }, { label: 'Principais' }]}
      />
      <div className="flex flex-col gap-md max-w-7xl">
        <label className="flex items-center gap-md">
          <span className="text-sm font-semibold text-neutral-700 shrink-0">Categoria</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-neutral-200 bg-white px-sm text-sm flex-1 max-w-2xl"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
          {FINANCEIRO_REPORTS.map((r) => (
            <ReportCardItem key={r.id} report={r} />
          ))}
        </div>
      </div>
    </>
  );
}

function ReportCardItem({ report }: { report: ReportCard }) {
  const inner = (
    <article className="rounded-md border border-neutral-200 bg-white p-md hover:border-primary-300 transition-colors h-full flex gap-sm">
      <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
        <DollarSign className="h-5 w-5 text-primary-500" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-neutral-800 mb-xs">{report.title}</h3>
        {report.description && (
          <p className="text-xs text-neutral-500 leading-relaxed">{report.description}</p>
        )}
      </div>
    </article>
  );
  return report.to ? (
    <Link to={report.to} className="block h-full">{inner}</Link>
  ) : (
    <div className="cursor-default">{inner}</div>
  );
}
