import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';
import { toast } from 'sonner';
import { MemberEditDialog } from '../components/MemberEditDialog';
import { InviteMemberDialog } from '../components/InviteMemberDialog';
import { DeactivateMemberDialog } from '../components/DeactivateMemberDialog';
import {
  UpdateMemberMutation,
  InviteMemberMutation,
  DeactivateMemberMutation,
} from '@/features/catalog/api/members.api';
import type { AdminMemberData } from '@/features/catalog/api/members.api';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

const professionalMember: AdminMemberData = {
  id: 'mem-1',
  displayName: 'Ana Silva',
  email: 'ana@test.com',
  roleName: 'PROFESSIONAL',
  seniorityTier: 'senior',
  isProfessional: true,
  status: 'active',
};

const attendantMember: AdminMemberData = {
  id: 'mem-2',
  displayName: 'Bruno Souza',
  email: 'bruno@test.com',
  roleName: 'ATTENDANT',
  seniorityTier: null,
  isProfessional: false,
  status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// MemberEditDialog
// ---------------------------------------------------------------------------

describe('MemberEditDialog', () => {
  it('pre-fills role, isProfessional and seniority from the member', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <MemberEditDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    expect(screen.getByLabelText('É profissional')).toBeChecked();
    expect(
      screen.getByRole('combobox', { name: 'Senioridade' }),
    ).not.toBeDisabled();
  });

  it('marking isProfessional enables seniority; unmarking disables and clears it', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <MemberEditDialog member={attendantMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    const seniorityTrigger = screen.getByRole('combobox', { name: 'Senioridade' });
    expect(seniorityTrigger).toBeDisabled();

    fireEvent.click(screen.getByLabelText('É profissional'));
    expect(seniorityTrigger).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText('É profissional'));
    expect(seniorityTrigger).toBeDisabled();
  });

  it('submits UpdateMemberMutation with id/roleName/isProfessional/seniorityTier and closes on success', async () => {
    const onClose = vi.fn();
    const mock = {
      request: {
        query: UpdateMemberMutation,
        variables: {
          input: {
            id: 'mem-1',
            roleName: 'PROFESSIONAL',
            isProfessional: true,
            seniorityTier: 'senior',
          },
        },
      },
      result: {
        data: {
          updateMember: {
            member: {
              id: 'mem-1',
              displayName: 'Ana Silva',
              roleName: 'PROFESSIONAL',
              seniorityTier: 'senior',
              isProfessional: true,
              status: 'active',
            },
            errors: [],
          },
        },
      },
    };

    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <MemberEditDialog member={professionalMember} open onClose={onClose} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows a field-level error when errors[0].field === "roleName"', async () => {
    const mock = {
      request: {
        query: UpdateMemberMutation,
        variables: {
          input: {
            id: 'mem-1',
            roleName: 'PROFESSIONAL',
            isProfessional: true,
            seniorityTier: 'senior',
          },
        },
      },
      result: {
        data: {
          updateMember: {
            member: null,
            errors: [
              {
                code: 'INVALID_ROLE',
                message: 'Papel inválido para esta organização.',
                field: 'roleName',
              },
            ],
          },
        },
      },
    };

    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <MemberEditDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(
        screen.getByText('Papel inválido para esta organização.'),
      ).toBeInTheDocument();
    });
  });

  it('shows toast.error when the server error has no field', async () => {
    const mock = {
      request: {
        query: UpdateMemberMutation,
        variables: {
          input: {
            id: 'mem-1',
            roleName: 'PROFESSIONAL',
            isProfessional: true,
            seniorityTier: 'senior',
          },
        },
      },
      result: {
        data: {
          updateMember: {
            member: null,
            errors: [
              { code: 'FORBIDDEN', message: 'Você não tem permissão.', field: null },
            ],
          },
        },
      },
    };

    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <MemberEditDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Você não tem permissão.');
    });
  });
});

// ---------------------------------------------------------------------------
// InviteMemberDialog
// ---------------------------------------------------------------------------

describe('InviteMemberDialog', () => {
  it('requires a valid email and a role before submitting', async () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteMemberDialog open onClose={vi.fn()} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }));

    await waitFor(() => {
      expect(screen.getByText('Este campo é obrigatório.')).toBeInTheDocument();
      expect(screen.getByText('Selecione um papel.')).toBeInTheDocument();
    });
  });

  it('keeps the seniority select disabled until isProfessional is checked', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <InviteMemberDialog open onClose={vi.fn()} />
      </MockedProvider>,
    );

    const seniorityTrigger = screen.getByRole('combobox', { name: 'Senioridade' });
    expect(seniorityTrigger).toBeDisabled();

    fireEvent.click(screen.getByLabelText('É profissional'));
    expect(seniorityTrigger).not.toBeDisabled();
  });

  it('submits InviteMemberMutation with email, role, isProfessional and seniority; toasts and closes on success', async () => {
    const onClose = vi.fn();
    const mock = {
      request: {
        query: InviteMemberMutation,
        variables: {
          input: {
            email: 'novo@studio.com',
            roleName: 'PROFESSIONAL',
            isProfessional: true,
            seniorityTier: 'senior',
          },
        },
      },
      result: {
        data: {
          inviteMember: {
            invitationId: 'inv-1',
            expiresAt: '2026-10-05T00:00:00Z',
            errors: [],
          },
        },
      },
    };

    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <InviteMemberDialog open onClose={onClose} />
      </MockedProvider>,
    );

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'novo@studio.com' },
    });

    fireEvent.click(screen.getByRole('combobox', { name: 'Papel' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Profissional' }));

    fireEvent.click(screen.getByLabelText('É profissional'));

    fireEvent.click(screen.getByRole('combobox', { name: 'Senioridade' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Sênior' }));

    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows EMAIL_TAKEN error on the email field, not as a toast', async () => {
    const mock = {
      request: {
        query: InviteMemberMutation,
        variables: {
          input: {
            email: 'ja-existe@studio.com',
            roleName: 'ATTENDANT',
            isProfessional: false,
            seniorityTier: null,
          },
        },
      },
      result: {
        data: {
          inviteMember: {
            invitationId: null,
            expiresAt: null,
            errors: [{ code: 'EMAIL_TAKEN', message: 'Este e-mail já está em uso.' }],
          },
        },
      },
    };

    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <InviteMemberDialog open onClose={vi.fn()} />
      </MockedProvider>,
    );

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'ja-existe@studio.com' },
    });
    fireEvent.click(screen.getByRole('combobox', { name: 'Papel' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Atendente' }));

    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }));

    await waitFor(() => {
      expect(screen.getByText('Este e-mail já está em uso.')).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// DeactivateMemberDialog
// ---------------------------------------------------------------------------

describe('DeactivateMemberDialog', () => {
  it('shows a confirmation state with a destructive action', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <DeactivateMemberDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    expect(screen.getByText('Desativar Ana Silva?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
  });

  it('keeps the dialog open and shows blocking appointments when the backend refuses', async () => {
    const mock = {
      request: { query: DeactivateMemberMutation, variables: { id: 'mem-1' } },
      result: {
        data: {
          deactivateMember: {
            member: null,
            futureAppointmentCount: 2,
            blockingAppointments: [
              {
                id: 'appt-1',
                startsAt: '2026-10-10T14:00:00Z',
                clientName: 'Maria Cliente',
                serviceName: 'Corte feminino',
              },
              {
                id: 'appt-2',
                startsAt: '2026-10-11T09:00:00Z',
                clientName: 'João Cliente',
                serviceName: 'Barba',
              },
            ],
            activeCommissionRuleCount: 0,
            errors: [
              {
                code: 'MEMBER_HAS_FUTURE_APPOINTMENTS',
                message: 'Há agendamentos futuros.',
                field: null,
              },
            ],
          },
        },
      },
    };
    const onClose = vi.fn();

    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <DeactivateMemberDialog member={professionalMember} open onClose={onClose} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(
        screen.getByText('Não é possível desativar Ana Silva agora'),
      ).toBeInTheDocument();
      expect(screen.getByText('Maria Cliente', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('João Cliente', { exact: false })).toBeInTheDocument();
    });

    // Dialog stays open (blocked state renders instead of unmounting) and the
    // member is never deactivated on the client.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes with an informative commission note when activeCommissionRuleCount > 0', async () => {
    const mock = {
      request: { query: DeactivateMemberMutation, variables: { id: 'mem-1' } },
      result: {
        data: {
          deactivateMember: {
            member: { id: 'mem-1', status: 'inactive' },
            futureAppointmentCount: 0,
            blockingAppointments: [],
            activeCommissionRuleCount: 3,
            errors: [],
          },
        },
      },
    };
    const onClose = vi.fn();

    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <DeactivateMemberDialog member={professionalMember} open onClose={onClose} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(toast.message).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('closes with a simple toast when activeCommissionRuleCount === 0', async () => {
    const mock = {
      request: { query: DeactivateMemberMutation, variables: { id: 'mem-1' } },
      result: {
        data: {
          deactivateMember: {
            member: { id: 'mem-1', status: 'inactive' },
            futureAppointmentCount: 0,
            blockingAppointments: [],
            activeCommissionRuleCount: 0,
            errors: [],
          },
        },
      },
    };
    const onClose = vi.fn();

    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <DeactivateMemberDialog member={professionalMember} open onClose={onClose} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(toast.message).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
