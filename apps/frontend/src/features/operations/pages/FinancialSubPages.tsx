import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FinancialReportLayout,
  ReportEmptyState,
  ReportTabs,
} from '../components/FinancialReportLayout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DateField({ label }: { label: string }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <Input type="text" placeholder="dd/mm/aaaa" className="h-9 text-sm w-[140px]" />
    </label>
  );
}

function SelectField({
  label,
  options,
  defaultValue,
}: {
  label: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <select
        defaultValue={defaultValue ?? options[0]}
        className="h-9 rounded-md border border-neutral-200 bg-white px-sm text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Financeiro — Caixa ───────────────────────────────────────────────────────

export function FinanceiroCaixaPage() {
  return (
    <FinancialReportLayout
      title="Relatório de Movimentações Financeiras"
      filters={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          <SelectField
            label="Tipo de data"
            options={['Data de Pagamento/Estorno', 'Data de Atendimento/Venda']}
          />
          <DateField label="entre" />
          <DateField label="e" />
          <label className="flex items-center gap-xs mt-md">
            <input type="checkbox" className="rounded border-neutral-300" />
            <span className="text-xs text-neutral-700">Exibir estornos</span>
          </label>
          <SelectField
            label="Listar fechamentos com:"
            options={['Todos', 'Apenas Serviços', 'Apenas Produtos', 'Apenas Pacotes']}
          />
          <SelectField
            label="Listar fechamentos com desconto:"
            options={['Com e sem desconto', 'Com desconto', 'Sem desconto']}
          />
        </div>
      }
      onPrimaryAction={() => {}}
      onExport={() => {}}
      onClear={() => {}}
    >
      {/* Resumo de Movimentação table */}
      <section>
        <h2 className="text-sm font-semibold text-primary-500 mb-sm">
          Resumo de Movimentação de Entradas e Saídas
        </h2>
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-error-500 text-white text-center">
                <th className="px-sm py-sm font-semibold border-r border-white/20" rowSpan={2}>
                  Data
                </th>
                <th className="px-sm py-sm font-semibold border-r border-white/20" colSpan={6}>
                  Em dinheiro
                </th>
                <th className="px-sm py-sm font-semibold" colSpan={2}>
                  Em outras formas de pagamento
                </th>
              </tr>
              <tr className="bg-error-500/90 text-white text-center">
                {[
                  'Abertura do caixa',
                  'Recebido',
                  'Troco',
                  'Despesas pagas (caixa)',
                  'Total em dinheiro',
                  'Sangria',
                  'Saldo do caixa',
                  'Recebido',
                  'Despesas pagas',
                ].map((h) => (
                  <th key={h} className="px-xs py-xs font-medium border-r border-white/10 last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-neutral-50">
                <td className="px-sm py-sm text-center">07/05/2026</td>
                {Array.from({ length: 9 }).map((_, i) => (
                  <td key={i} className="px-sm py-sm text-right text-neutral-500">
                    0,00
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </FinancialReportLayout>
  );
}

// ─── Pagamento de Profissionais ───────────────────────────────────────────────

const PAGAMENTO_TABS = [
  { id: 'lancamento', label: 'Lançamento de Pagamento' },
  { id: 'relatorio',  label: 'Relatório de Comissões' },
  { id: 'config',     label: 'Configurações adicionais de comissões' },
  { id: 'gorjetas',   label: 'Gorjetas' },
  { id: 'fechamento', label: 'Fechamento Mensal' },
] as const;

export function PagamentoProfissionaisPage() {
  const [tab, setTab] = useState<string>('lancamento');

  return (
    <div className="flex flex-col gap-md max-w-7xl">
      <header className="border-b border-neutral-200 pb-sm">
        <h1 className="text-base font-semibold text-neutral-700">Pagamento de profissionais</h1>
      </header>

      <ReportTabs
        tabs={PAGAMENTO_TABS.map((t) => ({
          id: t.id,
          label: t.label,
          active: tab === t.id,
          onClick: () => setTab(t.id),
        }))}
      />

      {tab === 'lancamento' && <PagamentoLancamentoTab />}
      {tab === 'relatorio' && <PagamentoRelatorioTab />}
      {tab === 'config' && <PagamentoConfigTab />}
      {tab === 'gorjetas' && (
        <ReportEmptyState
          title="Gorjetas"
          body="Configure como as gorjetas serão repassadas aos profissionais."
        />
      )}
      {tab === 'fechamento' && (
        <ReportEmptyState
          title="Fechamento mensal"
          body="O fechamento consolida todos os pagamentos do mês para auditoria."
        />
      )}
    </div>
  );
}

function PagamentoLancamentoTab() {
  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap gap-xs">
        <span className="rounded-md border border-error-500/40 bg-white px-sm py-xs text-xs text-error-500 font-medium">
          Ordenado por: Profissional
        </span>
        <span className="rounded-md border border-error-500/40 bg-white px-sm py-xs text-xs text-error-500 font-medium">
          01/05/2026 - 31/05/2026
        </span>
        <span className="rounded-md border border-error-500/40 bg-white px-sm py-xs text-xs text-error-500 font-medium">
          Profissionais: Todos
        </span>
      </div>

      <div className="rounded-md border border-neutral-200 bg-white p-md grid grid-cols-1 sm:grid-cols-3 gap-md items-center">
        <div className="text-center sm:text-left">
          <p className="text-xs text-neutral-500">Total em comissões</p>
          <p className="text-sm font-bold text-neutral-800">R$ 0,00</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-neutral-500">Total em gorjetas</p>
          <p className="text-sm font-bold text-neutral-800">R$ 0,00</p>
        </div>
        <div className="rounded-md bg-success-50 border border-success-200 px-md py-sm">
          <div className="flex justify-between text-xs text-neutral-600">
            <span>Total pago</span>
            <span>Total restante</span>
          </div>
          <div className="flex justify-between text-sm font-bold mt-xs">
            <span className="text-neutral-800">R$ 0,00</span>
            <span className="text-neutral-800">R$ 0,00</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-xs">
        <Button variant="outline" size="sm" className="border-error-500 text-error-500">
          Resumo do profissional <ChevronDown className="h-3 w-3 ml-xs" />
        </Button>
        <Button size="sm" className="bg-error-500 hover:bg-error-700 text-white">
          Lançar pagamento
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs">
            <tr>
              <th className="px-md py-sm text-left font-semibold">Profissional</th>
              <th className="px-md py-sm text-right font-semibold">Valor em comissões</th>
              <th className="px-md py-sm text-right font-semibold">Valor em gorjetas</th>
              <th className="px-md py-sm text-right font-semibold">Valor pago</th>
              <th className="px-md py-sm text-right font-semibold">Valor restante</th>
              <th className="px-md py-sm w-[40px]" />
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-neutral-200">
              <td className="px-md py-sm">DANIEL</td>
              <td className="px-md py-sm text-right">R$ 0,00</td>
              <td className="px-md py-sm text-right">R$ 0,00</td>
              <td className="px-md py-sm text-right">R$ 0,00</td>
              <td className="px-md py-sm text-right">R$ 0,00</td>
              <td className="px-md py-sm text-right text-neutral-400">⋮</td>
            </tr>
          </tbody>
        </table>
        <div className="px-md py-sm text-xs text-neutral-500 text-right">
          ‹ Anterior | <strong>1</strong> | Próxima ›
        </div>
      </div>
    </div>
  );
}

function PagamentoRelatorioTab() {
  return (
    <FinancialReportLayout
      title=""
      filters={
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-md">
          <SelectField label="Tipo de data" options={['Data de Pagamento/Estorno']} />
          <DateField label="entre" />
          <DateField label="e" />
          <SelectField label="do profissional" options={['Todos']} />
          <SelectField label="Listar vendas de:" options={['Todos']} />
          <label className="flex items-center gap-xs mt-md">
            <input type="checkbox" className="rounded border-neutral-300" />
            <span className="text-xs text-neutral-700">Exibir estorno</span>
          </label>
          <SelectField label="Status de pagamento:" options={['Todos']} />
          <SelectField label="Relação Profissional:" options={['Todas']} />
        </div>
      }
      onPrimaryAction={() => {}}
      onClear={() => {}}
      showExport={false}
    >
      <ReportEmptyState
        title="Verifique o filtro sugerido, altere se necessário e clique em 'Filtrar' para carregar o relatório!"
      />
    </FinancialReportLayout>
  );
}

function PagamentoConfigTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-md">
      <div className="space-y-md">
        <ConfigSection title="Definição da nomenclatura">
          <p className="text-xs text-neutral-600 mb-sm">
            Defina qual nomenclatura deve ser exibida no SGS para indicar os valores recebidos pelos
            profissionais referentes à venda e realização de serviços, produtos e pacotes.
          </p>
          <div className="flex gap-md">
            <label className="flex items-center gap-xs">
              <input type="radio" name="nomenclatura" defaultChecked />
              <span className="text-sm">Comissão</span>
            </label>
            <label className="flex items-center gap-xs">
              <input type="radio" name="nomenclatura" />
              <span className="text-sm">Rateio</span>
            </label>
          </div>
        </ConfigSection>

        <ConfigSection title="Recebimento da comissão">
          <div className="flex gap-md">
            <label className="flex items-center gap-xs">
              <input type="radio" name="recebimento" defaultChecked />
              <span className="text-sm">Data do fechamento de conta</span>
            </label>
            <label className="flex items-center gap-xs">
              <input type="radio" name="recebimento" />
              <span className="text-sm">Data prevista de recebimento do estabelecimento</span>
            </label>
          </div>
        </ConfigSection>

        <ConfigSection title="Desconto da taxa da operadora">
          <p className="text-xs text-neutral-600 mb-sm">
            Cada taxa definida em "Formas de pagamento" é aplicada sobre o valor do item depois do
            cálculo da comissão.
          </p>
          <div className="flex gap-md">
            <label className="flex items-center gap-xs">
              <input type="radio" name="taxa" />
              <span className="text-sm">Descontar do profissional</span>
            </label>
            <label className="flex items-center gap-xs">
              <input type="radio" name="taxa" defaultChecked />
              <span className="text-sm">Não descontar do profissional</span>
            </label>
          </div>
        </ConfigSection>

        <ConfigSection title="Desconto dos custos operacionais">
          <p className="text-xs text-neutral-600 mb-sm">
            Defina como o custo operacional do serviço deve ser considerado no cálculo da comissão.
          </p>
          <div className="flex flex-col gap-xs">
            {[
              'Não desconta custo operacional do serviço no cálculo da comissão',
              'Desconta o custo operacional do serviço antes do cálculo da comissão',
              'Desconta o custo operacional do serviço após o cálculo da comissão',
            ].map((opt, i) => (
              <label key={opt} className="flex items-start gap-xs">
                <input type="radio" name="custo" defaultChecked={i === 1} className="mt-0.5" />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </ConfigSection>
      </div>

      {/* Sticky right rail */}
      <aside className="sticky top-[5rem] self-start space-y-xs rounded-md border border-neutral-200 bg-white p-md text-sm">
        <p className="text-error-500 font-semibold border-b border-neutral-200 pb-xs mb-sm">
          Definição da nomenclatura
        </p>
        {[
          'Recebimento da comissão',
          'Desconto da taxa da operadora',
          'Desconto dos custos operacionais',
          'Recebíveis adicionais',
          'Abatimentos adicionais',
          'Resumo do profissional',
        ].map((label) => (
          <a key={label} href="#" className="block text-neutral-600 hover:text-primary-500">
            {label}
          </a>
        ))}
        <Button className="bg-error-500 hover:bg-error-700 text-white w-full mt-md">Salvar</Button>
        <Button variant="outline" className="border-error-500 text-error-500 w-full">
          Recalcular comissões
        </Button>
      </aside>
    </div>
  );
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-neutral-200 bg-white p-md">
      <header className="bg-neutral-50 -m-md mb-md p-md border-b border-neutral-200 rounded-t-md">
        <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
      </header>
      {children}
    </section>
  );
}

// ─── Fluxo Financeiro por Forma de Pagamento ──────────────────────────────────

export function FluxoFinanceiroPage() {
  return (
    <FinancialReportLayout
      title="Fluxo Financeiro por Forma de Pagamento"
      filters={
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-md">
          <SelectField label="Tipo de data" options={['Data de Pagamento/Estorno']} />
          <DateField label="entre" />
          <DateField label="e" />
          <SelectField label="Apenas contas fechadas por:" options={['Todos']} />
          <SelectField label="Forma de Pagamento:" options={['Todos']} />
          <label className="flex items-center gap-xs mt-md">
            <input type="checkbox" className="rounded border-neutral-300" />
            <span className="text-xs text-neutral-700">Exibir estornos</span>
          </label>
          <label className="flex items-center gap-xs mt-md">
            <input type="checkbox" defaultChecked className="rounded border-neutral-300" />
            <span className="text-xs text-neutral-700">Exportar crédito cliente</span>
          </label>
        </div>
      }
      onPrimaryAction={() => {}}
      onExport={() => {}}
      onClear={() => {}}
    >
      <ReportEmptyState />
    </FinancialReportLayout>
  );
}

// ─── Despesas / Contas a Pagar ────────────────────────────────────────────────

export function DespesasPage() {
  const [tab, setTab] = useState<'lancamento' | 'tipos'>('lancamento');

  return (
    <div className="flex flex-col gap-md max-w-7xl">
      <header className="border-b border-neutral-200 pb-sm">
        <h1 className="text-base font-semibold text-neutral-700">Despesas/Contas a Pagar</h1>
      </header>

      <ReportTabs
        tabs={[
          { id: 'lancamento', label: 'Lançamento de despesas', active: tab === 'lancamento', onClick: () => setTab('lancamento') },
          { id: 'tipos',      label: 'Tipos de despesa',       active: tab === 'tipos',      onClick: () => setTab('tipos') },
        ]}
      />

      <section className="rounded-md border border-neutral-200 bg-neutral-50 p-md">
        <div className="flex flex-wrap items-end gap-md">
          <div className="flex items-end gap-xs">
            <Label className="text-xs font-semibold text-neutral-600 mb-xs">Período de</Label>
            <select className="h-9 rounded-md border border-neutral-200 bg-white px-sm text-sm">
              <option>Vencimento</option>
              <option>Pagamento</option>
            </select>
            <span className="text-sm text-neutral-500 mb-sm">entre</span>
            <Input className="h-9 w-[120px] text-sm" placeholder="dd/mm/aaaa" />
            <span className="text-sm text-neutral-500 mb-sm">e</span>
            <Input className="h-9 w-[120px] text-sm" placeholder="dd/mm/aaaa" />
          </div>
          <div className="flex items-center gap-xs ml-auto">
            <Button size="sm" className="bg-error-500 hover:bg-error-700 text-white">
              Pesquisar
            </Button>
            <Button size="sm" variant="ghost" className="text-neutral-500">
              Limpar
            </Button>
            <Button size="sm" variant="outline" className="border-error-500 text-error-500">
              Mais filtros <ChevronDown className="h-3 w-3 ml-xs" />
            </Button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div className="flex gap-xs">
          <Button size="sm" className="bg-error-500 hover:bg-error-700 text-white">
            + Incluir despesa
          </Button>
          <Button size="sm" className="bg-error-500 hover:bg-error-700 text-white">
            Renovar
          </Button>
        </div>
        <Button size="sm" variant="outline" className="border-error-500 text-error-500">
          Exportar
        </Button>
      </div>

      <ReportEmptyState />
    </div>
  );
}

// ─── Clientes em débito ───────────────────────────────────────────────────────

export function ClientesDebitoPage() {
  return (
    <FinancialReportLayout
      title="Clientes em Débito"
      description="Aqui você encontra os clientes que saíram sem pagar algum serviço que foi finalizado, produto que não teve a venda efetivada (paga) ou fechamentos de contas que foram deixados com dívida (parcial ou total). O filtro de período somente é aplicado para agendamentos finalizados não pagos e vendas ainda não efetivadas (pré-vendas). Fechamentos de contas deixados como dívida não são filtrados por período."
      filters={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
          <div className="flex items-end gap-xs">
            <Label className="text-xs font-semibold text-neutral-600 mb-xs">Atendimentos/Vendas do período de</Label>
            <Input className="h-9 w-[120px] text-sm" placeholder="dd/mm/aaaa" />
            <span className="text-sm text-neutral-500 mb-sm">até</span>
            <Input className="h-9 w-[120px] text-sm" placeholder="dd/mm/aaaa" />
          </div>
          <SelectField label="Filtrar por" options={['Nome', 'CPF', 'Telefone']} />
        </div>
      }
      primaryActionLabel="Pesquisar"
      onPrimaryAction={() => {}}
      onClear={() => {}}
      showExport={false}
    >
      <ReportEmptyState />
    </FinancialReportLayout>
  );
}

// ─── Crédito de cliente ───────────────────────────────────────────────────────

export function CreditoClientePage() {
  return (
    <FinancialReportLayout
      title="Crédito de cliente"
      filters={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
          <div className="flex items-end gap-xs">
            <Label className="text-xs font-semibold text-neutral-600 mb-xs">
              Clientes que deixaram crédito ou consumiram crédito entre:
            </Label>
            <Input className="h-9 w-[120px] text-sm" placeholder="dd/mm/aaaa" />
            <span className="text-sm text-neutral-500 mb-sm">e</span>
            <Input className="h-9 w-[120px] text-sm" placeholder="dd/mm/aaaa" />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="flex items-center gap-xs">
              <input type="radio" name="filtro-credito" defaultChecked />
              <span className="text-xs text-neutral-700">Apenas clientes com saldo para consumo</span>
            </label>
            <label className="flex items-center gap-xs">
              <input type="radio" name="filtro-credito" />
              <span className="text-xs text-neutral-700">Selecionar cliente</span>
            </label>
          </div>
        </div>
      }
      onPrimaryAction={() => {}}
      onClear={() => {}}
      showExport={false}
    >
      <div className="flex items-center justify-between mb-sm">
        <Button size="sm" className="bg-error-500 hover:bg-error-700 text-white">
          Incluir Crédito
        </Button>
        <Button size="sm" variant="outline" className="border-error-500 text-error-500">
          Exportar
        </Button>
      </div>
      <div className="rounded-md border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-warning-500 text-white">
            <tr>
              <th className="px-md py-sm text-center font-semibold">Cliente</th>
              <th className="px-md py-sm text-center font-semibold">Histórico</th>
              <th className="px-md py-sm w-[40px]" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="text-center py-md text-sm text-neutral-500">
                Não existem clientes com saldo de crédito
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </FinancialReportLayout>
  );
}

// ─── Motivos de desconto ──────────────────────────────────────────────────────

const MOTIVOS_DESCONTO = [
  { name: 'Aniversário',                refletir: 'Sim',  status: 'Ativo' },
  { name: 'Cartão fidelidade',          refletir: 'Não',  status: 'Ativo' },
  { name: 'Convênio',                   refletir: 'Sim',  status: 'Ativo' },
  { name: 'Cortesia',                   refletir: 'Não',  status: 'Ativo' },
  { name: 'Desconto adicional em pacote', refletir: 'Não', status: 'Ativo' },
  { name: 'Dia da semana promoção',     refletir: 'Sim',  status: 'Ativo' },
  { name: 'Motivo não informado*',      refletir: 'Sim',  status: 'Ativo' },
  { name: 'Pagamento à vista',          refletir: 'Sim',  status: 'Ativo' },
];

export function MotivosDescontoPage() {
  return (
    <div className="flex flex-col gap-md max-w-7xl">
      <header className="border-b border-neutral-200 pb-sm">
        <h1 className="text-base font-semibold text-primary-500">Motivos de Desconto</h1>
      </header>

      <section className="rounded-md border border-neutral-200 bg-neutral-50 p-md">
        <div className="flex flex-wrap items-end gap-md">
          <label className="flex flex-col gap-xs flex-1 min-w-[200px]">
            <span className="text-xs font-semibold text-neutral-600">Filtrar por</span>
            <Input className="h-9 text-sm" />
          </label>
          <label className="flex items-center gap-xs mb-sm">
            <input type="checkbox" defaultChecked className="rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">Apenas motivos ativos</span>
          </label>
          <div className="flex items-center gap-xs ml-auto">
            <Button size="sm" className="bg-error-500 hover:bg-error-700 text-white">
              Pesquisar
            </Button>
            <Button size="sm" variant="ghost" className="text-neutral-500">
              Limpar
            </Button>
          </div>
        </div>
      </section>

      <div>
        <Button size="sm" className="bg-error-500 hover:bg-error-700 text-white mb-sm">
          + Incluir Motivo
        </Button>

        <div className="rounded-md border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-warning-500 text-white text-xs">
              <tr>
                <th className="px-md py-sm text-left font-semibold">Descrição</th>
                <th className="px-md py-sm text-center font-semibold w-[180px]">Desconto reflete no rateio?</th>
                <th className="px-md py-sm text-center font-semibold w-[100px]">Status</th>
                <th className="px-md py-sm w-[80px]" />
              </tr>
            </thead>
            <tbody>
              {MOTIVOS_DESCONTO.map((m) => (
                <tr key={m.name} className="border-t border-neutral-200">
                  <td className="px-md py-sm">{m.name}</td>
                  <td className="px-md py-sm text-center">{m.refletir}</td>
                  <td className="px-md py-sm text-center">{m.status}</td>
                  <td className="px-md py-sm text-right space-x-xs">
                    <button className="text-warning-500" aria-label="Editar">✎</button>
                    <button className="text-error-500" aria-label="Remover">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-md py-sm bg-neutral-50 text-xs text-neutral-500 text-right border-t border-neutral-200">
            8 registro(s) | « ‹ <strong>1</strong> / 1 › »
          </div>
        </div>

        <p className="text-xs text-error-500 mt-sm">
          * Motivo de Desconto padrão do sistema. Não pode ter o nome alterado e nem ser desativado!
        </p>
      </div>
    </div>
  );
}

// ─── Generic placeholder for routes without dedicated content ─────────────────

export function ContasFinanceirasPage() {
  return (
    <FinancialReportLayout
      title="Contas financeiras"
      filters={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
          <SelectField label="Tipo de conta" options={['Todas', 'Conta corrente', 'Caixa']} />
          <SelectField label="Status" options={['Ativas', 'Inativas']} />
        </div>
      }
      onPrimaryAction={() => {}}
      onClear={() => {}}
      showExport={false}
    >
      <ReportEmptyState />
    </FinancialReportLayout>
  );
}

export function ExportacaoLancamentosPage() {
  return (
    <FinancialReportLayout
      title="Exportação Lançamentos Financeiros"
      filters={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
          <SelectField label="Tipo de data" options={['Data de Pagamento/Estorno']} />
          <DateField label="entre" />
          <DateField label="e" />
        </div>
      }
      onPrimaryAction={() => {}}
      onExport={() => {}}
      onClear={() => {}}
    >
      <ReportEmptyState body="Defina o período e clique em Exportar para baixar o arquivo CSV." />
    </FinancialReportLayout>
  );
}

export function LancamentoAntecipacaoPage() {
  return (
    <FinancialReportLayout
      title="Lançamento de antecipação"
      filters={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
          <SelectField label="Cliente" options={['Selecione…']} />
          <SelectField label="Tipo de antecipação" options={['Selecione…', 'Pacote', 'Crédito']} />
        </div>
      }
      primaryActionLabel="Lançar"
      onPrimaryAction={() => {}}
      onClear={() => {}}
      showExport={false}
    >
      <ReportEmptyState body="Selecione o cliente e tipo de antecipação para registrar." />
    </FinancialReportLayout>
  );
}
