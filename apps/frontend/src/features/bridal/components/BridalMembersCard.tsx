import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ServicesQuery, type ServicesQueryResult } from '@/features/catalog/api/servicos.api';
import {
  AddBridalGroupMemberMutation,
  RemoveBridalGroupMemberMutation,
  SetBridalMemberCoverageMutation,
  SetBridalMemberServicesMutation,
  type BridalGroupData,
  type BridalGroupPayload,
  type BridalMemberData,
  type BridalUserError,
} from '../api/bridal.api';
import { useBridalPermission } from '../bridal-permissions';
import { PURPOSE_LABEL, ROLE_LABEL, errorMessage } from '../lib/bridal-labels';
import { buildPersonInput, emptyPerson, type PersonDraft } from '../lib/person-draft';
import { BridalPersonFields } from './BridalPersonFields';

interface Props {
  group: BridalGroupData;
}

function ServicesDialog({
  member,
  onClose,
  onError,
}: {
  member: BridalMemberData;
  onClose: () => void;
  onError: (errs: BridalUserError[]) => void;
}) {
  const { data } = useQuery<ServicesQueryResult>(ServicesQuery);
  const [items, setItems] = useState(
    member.services.map((s) => ({ serviceId: s.serviceId, purpose: s.purpose })),
  );
  const [save, { loading }] = useMutation<{ setBridalMemberServices: BridalGroupPayload }>(
    SetBridalMemberServicesMutation,
  );
  const services = data?.services ?? [];

  async function submit() {
    const res = await save({ variables: { memberId: member.id, services: items } });
    const errs = res.data?.setBridalMemberServices.errors ?? [];
    if (errs.length > 0) {
      onError(errs);
      return;
    }
    toast.success('Serviços atualizados.');
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogTitle className="text-base font-bold">Serviços de {member.clientName}</DialogTitle>
        <DialogDescription className="text-sm text-neutral-600">
          Serviços planejados para o evento e para o teste.
        </DialogDescription>
        <Label className="text-xs font-semibold text-neutral-700" htmlFor="member-add-service">
          Adicionar serviço
        </Label>
        <select
          id="member-add-service"
          className="w-full rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white"
          value=""
          onChange={(e) => {
            if (e.target.value)
              setItems([...items, { serviceId: e.target.value, purpose: 'event' }]);
          }}
        >
          <option value="">Selecione…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <ul className="space-y-xs text-sm">
          {items.map((it, i) => (
            <li key={`${it.serviceId}-${i}`} className="flex items-center gap-sm">
              <span className="flex-1">
                {services.find((s) => s.id === it.serviceId)?.name ??
                  member.services.find((s) => s.serviceId === it.serviceId)?.serviceName ??
                  'Serviço'}
              </span>
              <span className="text-neutral-600">{PURPOSE_LABEL[it.purpose] ?? it.purpose}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                aria-label={`Remover serviço ${i + 1}`}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-sm">
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button type="button" disabled={loading} onClick={submit}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BridalMembersCard({ group }: Props) {
  const canWrite = useBridalPermission('bridal.write');
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<BridalMemberData | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PersonDraft>(() => emptyPerson(false));
  const [setCoverage] = useMutation<{ setBridalMemberCoverage: BridalGroupPayload }>(
    SetBridalMemberCoverageMutation,
  );
  const [removeMember] = useMutation<{ removeBridalGroupMember: BridalGroupPayload }>(
    RemoveBridalGroupMemberMutation,
  );
  const [addMember, { loading: addingLoading }] = useMutation<{
    addBridalGroupMember: BridalGroupPayload;
  }>(AddBridalGroupMemberMutation);
  const editable = canWrite && group.status === 'active';

  function showErrors(errs: BridalUserError[]) {
    const msgs = errs.map(errorMessage);
    setErrors(msgs);
    toast.error(msgs[0]);
  }

  async function toggleCoverage(m: BridalMemberData, covered: boolean) {
    setErrors([]);
    try {
      const res = await setCoverage({ variables: { memberId: m.id, covered } });
      const errs = res.data?.setBridalMemberCoverage.errors ?? [];
      if (errs.length > 0) showErrors(errs);
    } catch {
      setErrors(['Não foi possível alterar a cobertura. Tente novamente.']);
    }
  }

  async function remove(m: BridalMemberData) {
    setErrors([]);
    try {
      const res = await removeMember({ variables: { memberId: m.id } });
      const errs = res.data?.removeBridalGroupMember.errors ?? [];
      if (errs.length > 0) showErrors(errs);
      else toast.success('Pessoa removida do grupo.');
    } catch {
      setErrors(['Não foi possível remover a pessoa. Tente novamente.']);
    }
  }

  async function submitAdd() {
    const built = buildPersonInput(draft, 'Pessoa');
    if (!built.ok) {
      setErrors([built.error]);
      return;
    }
    const res = await addMember({ variables: { groupId: group.id, person: built.input } });
    const errs = res.data?.addBridalGroupMember.errors ?? [];
    if (errs.length > 0) {
      showErrors(errs);
      return;
    }
    toast.success('Pessoa adicionada.');
    setAdding(false);
    setDraft(emptyPerson(false));
  }

  return (
    <section aria-label="Pessoas do grupo" className="space-y-sm">
      <div aria-live="polite" role="alert" className="text-sm text-error" data-testid="members-errors">
        {errors.map((e) => (
          <p key={e}>{e}</p>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
            <tr>
              <th className="p-sm">Pessoa</th>
              <th className="p-sm">Papel</th>
              <th className="p-sm">Telefone</th>
              <th className="p-sm">Serviços planejados</th>
              <th className="p-sm">Contrato</th>
              <th className="p-sm">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {group.members.map((m) => {
              const locked = m.hasClosedComanda;
              return (
                <tr key={m.id} className="border-t border-neutral-200" data-testid={`member-${m.id}`}>
                  <td className="p-sm font-semibold">
                    {m.clientName}
                    {m.relationLabel && (
                      <span className="block text-xs font-normal text-neutral-600">
                        {m.relationLabel}
                      </span>
                    )}
                  </td>
                  <td className="p-sm">{ROLE_LABEL[m.role] ?? m.role}</td>
                  <td className="p-sm">{m.clientPhone ?? '—'}</td>
                  <td className="p-sm">
                    {m.services.length === 0
                      ? '—'
                      : m.services
                          .map(
                            (s) =>
                              `${s.serviceName}${s.purpose === 'trial' ? ' (teste)' : ''}`,
                          )
                          .join(', ')}
                    {editable && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => setEditing(m)}
                        aria-label={`Editar serviços de ${m.clientName}`}
                      >
                        Editar
                      </Button>
                    )}
                  </td>
                  <td className="p-sm">
                    <label
                      className="flex items-center gap-xs"
                      title={
                        locked
                          ? 'Comanda já fechada: a cobertura não pode mais ser alterada.'
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        role="switch"
                        checked={m.coveredByContract}
                        disabled={!editable || locked}
                        onChange={(e) => toggleCoverage(m, e.target.checked)}
                        data-testid={`coverage-${m.id}`}
                        aria-label={`Incluída no contrato: ${m.clientName}`}
                      />
                      {m.coveredByContract ? 'Incluída no contrato' : 'Paga avulso'}
                    </label>
                  </td>
                  <td className="p-sm">
                    {editable && m.role !== 'bride' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(m)}
                        aria-label={`Remover ${m.clientName}`}
                      >
                        Remover
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable && (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-xs h-4 w-4" aria-hidden="true" />
          Adicionar pessoa
        </Button>
      )}

      {editing && (
        <ServicesDialog member={editing} onClose={() => setEditing(null)} onError={showErrors} />
      )}
      {adding && (
        <Dialog open onOpenChange={(o) => !o && setAdding(false)}>
          <DialogContent className="max-w-[640px] max-h-[90vh] overflow-y-auto">
            <DialogTitle className="text-base font-bold">Adicionar pessoa</DialogTitle>
            <DialogDescription className="text-sm text-neutral-600">
              Acompanhante do grupo, com serviços planejados.
            </DialogDescription>
            <BridalPersonFields idPrefix="add-member" title="Acompanhante" value={draft} onChange={setDraft} />
            <div className="flex justify-end gap-sm">
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>
                Fechar
              </Button>
              <Button type="button" disabled={addingLoading} onClick={submitAdd}>
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
