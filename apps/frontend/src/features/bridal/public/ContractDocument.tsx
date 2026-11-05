import type { ReactNode } from 'react';
import type { ContractSnapshot } from '../api/public-contract.api';
import {
  formatBRLCents,
  formatDateBR,
  formatDateLongBR,
  parseBold,
  splitParagraphs,
} from '../lib/contract-rich-text';

function RichText({ text }: { text: string }) {
  return (
    <>
      {parseBold(text).map((r, i) =>
        r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>,
      )}
    </>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {splitParagraphs(text).map((p, i) => (
        <p key={i} className="whitespace-pre-line break-words">
          <RichText text={p} />
        </p>
      ))}
    </>
  );
}

function Field({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: ReactNode;
  span?: 1 | 2 | 3;
}) {
  const cls = span === 3 ? 'sm:col-span-3' : span === 2 ? 'sm:col-span-2' : '';
  return (
    <div className={`break-words border border-neutral-800 p-1.5 ${cls}`}>
      <dt className="inline font-bold">{label}</dt> <dd className="inline">{children}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-center text-base font-bold">{children}</h3>;
}

const CELL = 'break-words border border-neutral-800 p-1.5 align-top';
const EXTRA_PREFIX = 'Serviço Adicional:';

function paymentLabel(mode: ContractSnapshot['payment']['mode'], seq: number, total: number): string {
  if (mode === 'a_vista') return 'À VISTA';
  if (mode === 'sinal') return 'SINAL';
  return `SINAL ${seq}/${total}`;
}

/**
 * Renderização estruturada do snapshot do contrato (mesmos rótulos e ordem do PDF).
 * Contém dados pessoais da contratante: nada daqui é logado nem enviado a analytics.
 */
export function ContractDocument({ snapshot: s }: { snapshot: ContractSnapshot }) {
  const c = s.contractor;
  const b = s.budget;
  const pay = s.payment;
  const place = s.studio.forumCity || s.studio.address;

  return (
    <article
      aria-label="Texto do contrato"
      className="space-y-4 rounded-md border border-neutral-200 bg-white p-md text-[15px] leading-relaxed text-neutral-900 sm:text-sm"
    >
      <h2 className="text-base font-bold uppercase">{s.texts.title}</h2>
      <Paragraphs text={s.texts.intro} />
      <Paragraphs text={s.texts.parties} />

      <dl className="grid grid-cols-1 sm:grid-cols-3">
        {s.kind === 'debutante' ? (
          <>
            <Field label="Contratante:" span={2}>
              {c.name}
            </Field>
            <Field label="Debutante:">{s.debutanteName ?? ''}</Field>
          </>
        ) : (
          <Field label="Contratante:" span={3}>
            {c.name}
          </Field>
        )}
        <Field label="endereço:" span={2}>
          {c.address}
        </Field>
        <Field label="CEP:">{c.postalCode}</Field>
        <Field label="CPF:">{c.cpf}</Field>
        <Field label="RG:">{c.rg}</Field>
        <Field label="email:">{c.email}</Field>
        <Field label="Celular 1:">{c.phone1}</Field>
        <Field label="Celular 2:">{c.phone2}</Field>
        <Field label="Celular 3:">{c.phone3}</Field>
        <Field label="Data do Evento:" span={2}>
          {formatDateBR(s.event.date)}
        </Field>
        <Field label="Horário do evento:">{s.event.time}</Field>
        <Field label="Local:" span={3}>
          {s.event.locationName}
        </Field>
        <Field label="Endereço do atendimento:" span={3}>
          {s.event.serviceAddress}
        </Field>
      </dl>

      <section aria-label="Orçamento" className="space-y-2">
        <SectionTitle>Orçamento</SectionTitle>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th scope="col" className={`${CELL} w-[65%] text-left`}>
                Descrição
              </th>
              <th scope="col" className={`${CELL} text-right`}>
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {b.package && (
              <tr>
                <td className={CELL}>
                  <strong>Pacote contratado:</strong> {b.package.name}
                  {b.package.description && (
                    <span className="block text-[11px]">
                      <strong>Descrição:</strong> {b.package.description}
                    </span>
                  )}
                </td>
                <td className={`${CELL} text-right`}>{formatBRLCents(b.package.cents)}</td>
              </tr>
            )}
            {b.extras.map((e, i) => (
              <tr key={i}>
                <td className={CELL}>
                  {e.label.startsWith(EXTRA_PREFIX) ? (
                    <>
                      <strong>{EXTRA_PREFIX}</strong>
                      {e.label.slice(EXTRA_PREFIX.length)}
                    </>
                  ) : (
                    e.label
                  )}
                </td>
                <td className={`${CELL} text-right`}>{formatBRLCents(e.cents)}</td>
              </tr>
            ))}
            {b.discount && (
              <tr>
                <td className={CELL}>{b.discount.label}</td>
                <td className={`${CELL} text-right`}>- {formatBRLCents(b.discount.cents)}</td>
              </tr>
            )}
            <tr>
              <td className={CELL}>
                <strong>Total de serviços</strong>
              </td>
              <td className={`${CELL} text-right`}>
                <strong>Total: {formatBRLCents(b.totalCents)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <Paragraphs text={s.texts.trialNote} />

      <section aria-label="Forma de pagamento" className="space-y-2">
        <SectionTitle>FORMA DE PAGAMENTO</SectionTitle>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th scope="col" className={`${CELL} w-[40%] text-left`}>
                Parcela
              </th>
              <th scope="col" className={`${CELL} w-[30%] text-left`}>
                Data
              </th>
              <th scope="col" className={`${CELL} text-right`}>
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {pay.installments.map((i) => (
              <tr key={i.seq}>
                <th scope="row" className={`${CELL} text-left font-bold`}>
                  {paymentLabel(pay.mode, i.seq, pay.installments.length)}
                </th>
                <td className={CELL}>{formatDateBR(i.dueDate)}</td>
                <td className={`${CELL} text-right`}>{formatBRLCents(i.cents)}</td>
              </tr>
            ))}
            {pay.mode !== 'a_vista' && (
              <tr>
                <th scope="row" className={`${CELL} text-left font-bold`}>
                  RESTANTE PAGAMENTO
                </th>
                <td className={CELL} colSpan={2}>
                  Até {pay.balanceDueDaysBefore ?? 0} dias antes do evento
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="space-y-3 pt-2">
        <Paragraphs text={s.texts.clauses} />
      </div>

      <p className="pt-4">
        {place}, {formatDateLongBR(s.generatedOn)}
      </p>

      <div className="grid grid-cols-2 gap-6 pt-8 text-center font-bold">
        <p className="break-words border-t border-neutral-800 pt-1">CONTRATANTE</p>
        <p className="break-words border-t border-neutral-800 pt-1">
          {s.studio.name.toUpperCase()}
        </p>
      </div>
    </article>
  );
}
