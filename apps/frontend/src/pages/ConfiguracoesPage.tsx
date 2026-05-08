import { Link } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  Globe,
  CreditCard,
  Settings as SettingsIcon,
  CalendarRange,
  Star,
  Receipt,
  MessageSquare,
  Calendar,
  Award,
  Bell,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

interface ConfigItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
}

const SISTEMA: ConfigItem[] = [
  { id: 's1', label: 'Dados do estabelecimento',     to: '/configuracoes/dados',         icon: Building2 },
  { id: 's2', label: 'Perfis de acesso',              to: '/configuracoes/perfis',        icon: ShieldCheck },
  { id: 's3', label: 'Site e Agendamento Online',    to: '/configuracoes/site',          icon: Globe },
  { id: 's4', label: 'Formas de pagamento',          to: '/configuracoes/pagamentos',    icon: CreditCard },
  { id: 's5', label: 'Configurações gerais',          to: '/configuracoes/gerais',        icon: SettingsIcon },
  { id: 's6', label: 'Feriados e horários especiais', to: '/configuracoes/feriados',      icon: CalendarRange },
  { id: 's7', label: 'Pesquisa de satisfação',       to: '/configuracoes/satisfacao',    icon: Star },
];

const ADICIONAIS: ConfigItem[] = [
  { id: 'a1', label: 'Belezinha Stone',              to: '/configuracoes/belezinha',     icon: Receipt },
  { id: 'a2', label: 'Rotina de mensagens',          to: '/configuracoes/mensagens',     icon: MessageSquare },
  { id: 'a3', label: 'Convite de retorno',           to: '/configuracoes/convite',       icon: Calendar },
  { id: 'a4', label: 'Lembrete Premium',             to: '/configuracoes/lembrete',      icon: Bell },
  { id: 'a5', label: 'Programa de Fidelidade',       to: '/configuracoes/fidelidade',    icon: Award },
  { id: 'a6', label: 'Nota Fiscal de Serviços (NFS-e)', to: '/configuracoes/nfse',       icon: Receipt },
  { id: 'a7', label: 'Nota Fiscal do Consumidor (NFC-e)', to: '/configuracoes/nfce',     icon: Receipt },
];

function ConfigCard({ title, items }: { title: string; items: ConfigItem[] }) {
  return (
    <article className="rounded-md border border-neutral-200 bg-white">
      <header className="px-md py-sm border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-700">{title}</h2>
      </header>
      <ul>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id} className="border-b border-neutral-100 last:border-b-0">
              <Link
                to={item.to}
                className="flex items-center gap-sm px-md py-sm text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Icon className="h-4 w-4 text-neutral-500 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function ConfiguracoesPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-md max-w-5xl">
      <ConfigCard title="Configurações do sistema" items={SISTEMA} />
      <ConfigCard title="Configurações de adicionais" items={ADICIONAIS} />
    </div>
  );
}
