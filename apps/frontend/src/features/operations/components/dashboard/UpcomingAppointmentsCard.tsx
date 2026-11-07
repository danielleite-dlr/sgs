import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { pendingAppointments, type PendingAppointmentRow } from '../../lib/operational-dashboard';
import { BlockError, BlockLoading, LINK_CLASS, SECTION_TITLE_CLASS } from './BlockState';
import { useTodayAppointments } from './use-today-appointments';

function StatusBadge({ row }: { row: PendingAppointmentRow }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[12px] font-semibold leading-4 text-neutral-800">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.spineColor }} />
      {row.statusLabel}
    </span>
  );
}

export function UpcomingAppointmentsCard() {
  const { data, error, refetch } = useTodayAppointments();
  const rows = data ? pendingAppointments(data.appointments) : null;

  return (
    <Card data-testid="upcoming-appointments" className="max-w-none p-md">
      <div className="mb-sm flex flex-wrap items-baseline justify-between gap-sm">
        <h2 className={SECTION_TITLE_CLASS}>Próximos atendimentos</h2>
        <div className="flex items-baseline gap-md">
          {rows && <p className="text-data tabular-nums text-neutral-700">{rows.length} pendentes</p>}
          <Link to="/agenda" className={LINK_CLASS}>
            Ver agenda
          </Link>
        </div>
      </div>
      {error && !rows ? (
        <BlockError what="os atendimentos" onRetry={() => void refetch()} />
      ) : !rows ? (
        <BlockLoading testId="upcoming-appointments-loading" />
      ) : rows.length === 0 ? (
        <p className="text-body text-neutral-700">Nenhum atendimento pendente hoje</p>
      ) : (
        <>
          <table className="hidden w-full border-collapse text-left md:table">
            <thead>
              <tr className="bg-neutral-50 text-overline uppercase text-neutral-700">
                <th scope="col" className="p-sm font-semibold">Horário</th>
                <th scope="col" className="p-sm font-semibold">Cliente</th>
                <th scope="col" className="p-sm font-semibold">Serviço</th>
                <th scope="col" className="p-sm font-semibold">Profissional</th>
                <th scope="col" className="p-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  data-testid="appointment-row"
                  className="border-l-[3px] border-t border-t-neutral-200 text-body text-neutral-900"
                  style={{ borderLeftColor: r.spineColor }}
                >
                  <td className="p-sm">
                    <p className="font-semibold tabular-nums">{r.time}</p>
                    <p className="text-data tabular-nums text-neutral-700">{r.durationMinutes} min</p>
                  </td>
                  <td className="p-sm font-serif text-headline-sm">{r.clientName}</td>
                  <td className="p-sm">{r.serviceName}</td>
                  <td className="p-sm">{r.professionalName}</td>
                  <td className="p-sm"><StatusBadge row={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-sm md:hidden">
            {rows.map((r) => (
              <li
                key={r.id}
                data-testid="appointment-card"
                className="flex items-start justify-between gap-sm rounded-md border border-neutral-200 border-l-[3px] p-sm"
                style={{ borderLeftColor: r.spineColor }}
              >
                <div className="min-w-0">
                  <p className="text-body">
                    <span className="font-semibold tabular-nums text-neutral-900">{r.time}</span>{' '}
                    <span className="font-serif text-headline-sm text-neutral-900">{r.clientName}</span>
                  </p>
                  <p className="text-data text-neutral-700">
                    {r.serviceName} • {r.professionalName} • {r.durationMinutes} min
                  </p>
                </div>
                <StatusBadge row={r} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
