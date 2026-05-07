import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Construction, ChevronLeft, Check, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/PageHeader';
import { Link } from 'react-router-dom';
import {
  MOCK_COMMISSIONS,
  MOCK_PROFESSIONALS,
  type CommissionStatus,
} from '../mocks/financeiro.mock';

const PERIODS = ['Todos', 'Maio 2026', 'Abril 2026', 'Março 2026'];

function StatusBadge({ status }: { status: CommissionStatus }) {
  if (status === 'pago') {
    return (
      <Badge variant="outline" className="gap-xs bg-success-50 text-success-700 border-success-200">
        <Check className="h-3 w-3" />
        Pago
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-xs bg-warning-50 text-warning-700 border-warning-200">
      <Clock className="h-3 w-3" />
      Pendente
    </Badge>
  );
}

export function ComissoesCalculadasPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('Todos');
  const [professional, setProfessional] = useState('Todos');

  const filtered = MOCK_COMMISSIONS.filter((c) => {
    const matchPeriod = period === 'Todos' || c.period === period;
    const matchPro = professional === 'Todos' || c.professional === professional;
    return matchPeriod && matchPro;
  });

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-sm">
        <Badge
          variant="outline"
          className="gap-xs border-warning-500 text-warning-600 bg-warning-50 text-xs"
        >
          <Construction className="h-3 w-3" />
          Mockup — Phase 3 (em breve)
        </Badge>
      </div>

      <PageHeader
        title={t('operations.commissions.title', 'Comissões calculadas')}
        breadcrumbs={[
          { label: 'Financeiro', to: '/financeiro' },
          { label: 'Comissões' },
        ]}
        cta={
          <Button variant="outline" size="sm" asChild>
            <Link to="/financeiro">
              <ChevronLeft className="h-4 w-4 mr-xs" />
              Voltar ao Financeiro
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-sm">
        <div className="flex items-center gap-xs">
          <span className="text-sm text-neutral-600 font-medium">Período:</span>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-xs">
          <span className="text-sm text-neutral-600 font-medium">Profissional:</span>
          <Select value={professional} onValueChange={setProfessional}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {MOCK_PROFESSIONALS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(period !== 'Todos' || professional !== 'Todos') && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-neutral-500"
            onClick={() => { setPeriod('Todos'); setProfessional('Todos'); }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50">
              <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Profissional</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Período</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide text-right">Comandas</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide text-right">Total ganho</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-xl text-neutral-500 text-sm">
                  Nenhuma comissão encontrada para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="hover:bg-neutral-50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-sm">
                      <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center text-xs font-semibold text-primary-700">
                        {c.professional.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium text-neutral-800">{c.professional}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-700">{c.period}</TableCell>
                  <TableCell className="text-sm text-neutral-700 text-right">{c.comandas}</TableCell>
                  <TableCell className="text-sm font-semibold text-neutral-800 text-right">{c.totalEarned}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell>
                    {c.status === 'pendente' ? (
                      <Button variant="outline" size="sm" disabled className="text-xs">
                        Marcar como pago
                      </Button>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-neutral-400 text-center">
        {filtered.length} registro(s) encontrado(s)
      </p>
    </div>
  );
}
