import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Pencil, Power, Trash2, UserPlus } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  canInviteMembers,
  canManageMembers,
} from '@/features/identity/team-permissions';
import { InviteMemberDialog } from '@/features/identity/components/InviteMemberDialog';
import { MemberEditDialog } from '@/features/identity/components/MemberEditDialog';
import { DeactivateMemberDialog } from '@/features/identity/components/DeactivateMemberDialog';
import {
  AllMembersQuery,
  PendingInvitationsQuery,
  ReactivateMemberMutation,
  RevokeInvitationMutation,
} from '@/features/catalog/api/members.api';
import type {
  AdminMemberData,
  AllMembersResult,
  PendingInvitationData,
  PendingInvitationsResult,
  ReactivateMemberResult,
  RevokeInvitationResult,
} from '@/features/catalog/api/members.api';

/**
 * Same reasoning as DeactivateMemberDialog: date-fns isn't an installed
 * dependency yet, so pt-BR formatting goes through Intl instead.
 */
function formatExpiresAt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function seniorityLabel(
  t: (key: string) => string,
  tier: AdminMemberData['seniorityTier'],
): string {
  return tier ? t(`team.seniority.${tier}`) : t('team.seniority.none');
}

function roleLabel(t: (key: string) => string, roleName: string): string {
  return t(`team.roles.${roleName}`);
}

export function ProfissionaisPage() {
  const { t } = useTranslation();
  const roleName = useAuthStore((s) => s.roleName);
  const canInvite = canInviteMembers(roleName);
  const canManage = canManageMembers(roleName);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<AdminMemberData | null>(null);
  const [deactivatingMember, setDeactivatingMember] = useState<AdminMemberData | null>(null);

  useEffect(() => {
    document.title = t('pages.profissionais.tab');
  }, [t]);

  const { data, loading } = useQuery<AllMembersResult>(AllMembersQuery);
  const { data: invitesData, loading: invitesLoading } =
    useQuery<PendingInvitationsResult>(PendingInvitationsQuery);

  const members = data?.allMembers ?? [];
  const invitations = invitesData?.pendingInvitations ?? [];

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

  const [revokeInvitation] = useMutation<RevokeInvitationResult>(
    RevokeInvitationMutation,
    {
      update(cache) {
        cache.evict({ fieldName: 'pendingInvitations' });
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

  async function handleRevoke(invite: PendingInvitationData) {
    const res = await revokeInvitation({
      variables: { invitationId: invite.id },
    });
    const errors = res.data?.revokeInvitation.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
      return;
    }
    toast.success(t('team.toasts.invitationRevoked'));
  }

  const showEmpty =
    !loading &&
    !invitesLoading &&
    members.length === 0 &&
    invitations.length === 0;

  return (
    <>
      <PageHeader
        title={t('pages.profissionais.h1')}
        cta={
          canInvite ? (
            <Button onClick={() => setInviteOpen(true)}>
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
            <Button onClick={() => setInviteOpen(true)}>
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
                key: 'role',
                header: t('team.table.role'),
                cell: (r) => roleLabel(t, r.roleName),
              },
              {
                key: 'seniority',
                header: t('team.table.seniority'),
                cell: (r) => seniorityLabel(t, r.seniorityTier),
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
                            onSelect={(e) => {
                              e.preventDefault();
                              setEditingMember(r);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('team.actions.edit')}
                          </DropdownMenuItem>
                          {r.status === 'active' ? (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setDeactivatingMember(r);
                              }}
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

          {invitations.length > 0 && (
            <div className="mt-2xl space-y-md">
              <h2 className="text-base font-semibold text-neutral-800">
                {t('team.invitations.title')}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('team.invitations.table.email')}</TableHead>
                    <TableHead>{t('team.invitations.table.role')}</TableHead>
                    <TableHead>{t('team.invitations.table.seniority')}</TableHead>
                    <TableHead>{t('team.invitations.table.expiresAt')}</TableHead>
                    {canInvite && (
                      <TableHead>{t('team.invitations.table.actions')}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>{roleLabel(t, invite.roleName)}</TableCell>
                      <TableCell>
                        {seniorityLabel(t, invite.seniorityTier ?? null)}
                      </TableCell>
                      <TableCell>{formatExpiresAt(invite.expiresAt)}</TableCell>
                      {canInvite && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(invite)}
                          >
                            {t('team.actions.revoke')}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {canInvite && (
        <InviteMemberDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
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
