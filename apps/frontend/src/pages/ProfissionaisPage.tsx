import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { KeyRound, MoreHorizontal, Pencil, Power, Trash2, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import type { DataTableColumn } from '@/components/ui/data-table';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  canInviteMembers,
  canManageMembers,
} from '@/features/identity/team-permissions';
import { CreateMemberDialog } from '@/features/identity/components/CreateMemberDialog';
import { ResetMemberPasswordDialog } from '@/features/identity/components/ResetMemberPasswordDialog';
import { MemberEditDialog } from '@/features/identity/components/MemberEditDialog';
import { DeactivateMemberDialog } from '@/features/identity/components/DeactivateMemberDialog';
import { maskBrPhone } from '@/features/identity/member-validation';
import {
  AllMembersQuery,
  ReactivateMemberMutation,
} from '@/features/catalog/api/members.api';
import type {
  AdminMemberData,
  AllMembersResult,
  ReactivateMemberResult,
} from '@/features/catalog/api/members.api';

/** Formata E.164 brasileiro (+5511987654321) como (11) 98765-4321. */
function formatPhone(phone: string | null | undefined): string {
  return phone ? maskBrPhone(phone) : '—';
}

function roleLabel(t: (key: string) => string, roleName: string): string {
  return t(`team.roles.${roleName}`);
}

export function ProfissionaisPage() {
  const { t } = useTranslation();
  const roleName = useAuthStore((s) => s.roleName);
  const canInvite = canInviteMembers(roleName);
  const canManage = canManageMembers(roleName);
  const [createOpen, setCreateOpen] = useState(false);
  const [resettingMember, setResettingMember] = useState<AdminMemberData | null>(null);
  const [editingMember, setEditingMember] = useState<AdminMemberData | null>(null);
  const [deactivatingMember, setDeactivatingMember] = useState<AdminMemberData | null>(null);

  useEffect(() => {
    document.title = t('pages.profissionais.tab');
  }, [t]);

  const { data, loading } = useQuery<AllMembersResult>(AllMembersQuery);

  const members = data?.allMembers ?? [];

  const [reactivateMember] = useMutation<ReactivateMemberResult>(
    ReactivateMemberMutation,
    {
      update(cache, _result, { variables }) {
        cache.evict({ fieldName: 'allMembers' });
        cache.evict({ fieldName: 'members' });
        if (variables?.id) {
          cache.evict({
            id: cache.identify({ __typename: 'Member', id: variables.id as string }),
          });
        }
        cache.gc();
      },
    },
  );

  async function handleReactivate(member: AdminMemberData) {
    const res = await reactivateMember({ variables: { id: member.id } });
    const errors = res.data?.reactivateMember.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
      return;
    }
    toast.success(
      t('team.toasts.memberReactivated', { name: member.displayName }),
    );
  }

  const showEmpty = !loading && members.length === 0;

  return (
    <>
      <PageHeader
        title={t('pages.profissionais.h1')}
        cta={
          canInvite ? (
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('pages.profissionais.newCta')}
            </Button>
          ) : undefined
        }
      />

      {showEmpty ? (
        <div className="flex flex-col items-center justify-center py-2xl text-center space-y-md">
          <UserPlus className="h-12 w-12 text-neutral-500" />
          <h2 className="text-base font-semibold">{t('team.empty.heading')}</h2>
          <p className="text-sm text-neutral-500 max-w-md">
            {t('team.empty.body')}
          </p>
          {canInvite && (
            <Button onClick={() => setCreateOpen(true)}>
              {t('team.empty.cta')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <DataTable<AdminMemberData>
            rowKey={(r) => r.id}
            loading={loading}
            rows={members}
            columns={[
              {
                key: 'name',
                header: t('team.table.name'),
                cell: (r) => (
                  <div className="flex items-center gap-2">
                    <EntityAvatar name={r.displayName} kind="client" />
                    <span className="font-semibold">{r.displayName}</span>
                    {r.isProfessional && (
                      <Badge variant="secondary">
                        {t('team.badge.professional')}
                      </Badge>
                    )}
                  </div>
                ),
              },
              {
                key: 'email',
                header: t('team.table.email'),
                cell: (r) => r.email,
              },
              {
                key: 'phone',
                header: t('team.table.phone'),
                cell: (r) => formatPhone(r.phone),
              },
              {
                key: 'role',
                header: t('team.table.role'),
                cell: (r) => roleLabel(t, r.roleName),
              },
              {
                key: 'categories',
                header: t('team.table.categories'),
                cell: (r) =>
                  r.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {r.categories.map((c) => (
                        <Badge key={c.id} variant="outline">
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'status',
                header: t('team.table.status'),
                cell: (r) => (
                  <Badge variant={r.status === 'active' ? 'success' : 'outline'}>
                    {t(`team.status.${r.status}`)}
                  </Badge>
                ),
              },
              ...(canManage
                ? [
                  {
                    key: 'actions',
                    header: t('team.table.actions'),
                    cell: (r) => (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" aria-label={t('team.table.actions')}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={() => setEditingMember(r)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('team.actions.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setResettingMember(r)}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            {t('team.actions.resetPassword')}
                          </DropdownMenuItem>
                          {r.status === 'active' ? (
                            <DropdownMenuItem
                              onSelect={() => setDeactivatingMember(r)}
                              className="text-error-500"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('team.actions.deactivate')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => handleReactivate(r)}>
                              <Power className="mr-2 h-4 w-4" />
                              {t('team.actions.reactivate')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ),
                  } satisfies DataTableColumn<AdminMemberData>,
                  ]
                : []),
            ]}
          />

        </>
      )}

      {canInvite && (
        <CreateMemberDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          callerRoleName={roleName}
        />
      )}
      {canManage && resettingMember && (
        <ResetMemberPasswordDialog
          member={resettingMember}
          open
          onClose={() => setResettingMember(null)}
        />
      )}
      {canManage && editingMember && (
        <MemberEditDialog
          member={editingMember}
          open
          onClose={() => setEditingMember(null)}
        />
      )}
      {canManage && deactivatingMember && (
        <DeactivateMemberDialog
          member={deactivatingMember}
          open
          onClose={() => setDeactivatingMember(null)}
        />
      )}
    </>
  );
}
