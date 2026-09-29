import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';
import { toast } from 'sonner';
import { MemberEditDialog } from '../components/MemberEditDialog';
import { InviteMemberDialog } from '../components/InviteMemberDialog';
import { CreateMemberDialog } from '../components/CreateMemberDialog';
import { ResetMemberPasswordDialog } from '../components/ResetMemberPasswordDialog';
import { DeactivateMemberDialog } from '../components/DeactivateMemberDialog';
import {
  UpdateMemberMutation,
  InviteMemberMutation,
  DeactivateMemberMutation,
  CreateMemberMutation,
  ResetMemberPasswordMutation,
} from '@/features/catalog/api/members.api';
import { CategoriesQuery } from '@/features/catalog/api/categorias.api';
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
  phone: '+5511987654321',
  pixKey: '12345678909',
  birthDate: null,
  categories: [{ id: 'cat-1', name: 'Cabelo' }],
};

const attendantMember: AdminMemberData = {
  id: 'mem-2',
  displayName: 'Bruno Souza',
  email: 'bruno@test.com',
  roleName: 'ATTENDANT',
  seniorityTier: null,
  isProfessional: false,
  status: 'active',
  phone: null,
  pixKey: null,
  birthDate: null,
  categories: [],
};

const categoriesMock = {
  request: { query: CategoriesQuery },
  result: {
    data: {
      categories: [
        {
          id: 'cat-1',
          name: 'Cabelo',
          parentId: null,
          displayOrder: 1,
          coverImageUrl: null,
          children: [
            {
              id: 'cat-1-1',
              name: 'Coloração',
              parentId: 'cat-1',
              displayOrder: 1,
              coverImageUrl: null,
            },
          ],
        },
        {
          id: 'cat-2',
          name: 'Maquiagem',
          parentId: null,
          displayOrder: 2,
          coverImageUrl: null,
          children: [],
        },
      ],
    },
  },
};

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// MemberEditDialog
// ---------------------------------------------------------------------------

describe('MemberEditDialog', () => {
  it('pre-fills role, isProfessional and seniority from the member', () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <MemberEditDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    // Papel PROFESSIONAL implica profissional: o checkbox fica escondido.
    expect(screen.queryByLabelText('É profissional')).toBeNull();
    expect(screen.getByLabelText('Telefone')).toHaveValue('(11) 98765-4321');
    expect(screen.getByLabelText('Chave Pix')).toHaveValue('12345678909');
    expect(
      screen.getByRole('combobox', { name: 'Senioridade' }),
    ).not.toBeDisabled();
  });

  it('marking isProfessional enables seniority; unmarking disables and clears it', () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
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
            categoryIds: ['cat-1'],
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
              phone: '+5511987654321',
              pixKey: '12345678909',
              birthDate: null,
              categories: [{ id: 'cat-1', name: 'Cabelo' }],
            },
            errors: [],
          },
        },
      },
    };

    render(
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
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
            categoryIds: ['cat-1'],
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
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
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
            categoryIds: ['cat-1'],
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
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
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

// ---------------------------------------------------------------------------
// MemberEditDialog — extended fields
// ---------------------------------------------------------------------------

describe('MemberEditDialog (contato e categorias)', () => {
  it('professional role hides the isProfessional checkbox and shows categories', async () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <MemberEditDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Papel' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Atendente' }));
    expect(screen.getByLabelText('É profissional')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Papel' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Profissional' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('É profissional')).toBeNull();
    });
    expect(await screen.findByLabelText('Cabelo')).toBeChecked();
  });

  it('legacy member without phone/pix can be saved without filling them', async () => {
    const onClose = vi.fn();
    const mock = {
      request: {
        query: UpdateMemberMutation,
        variables: {
          input: {
            id: 'mem-2',
            roleName: 'ATTENDANT',
            isProfessional: false,
            seniorityTier: null,
          },
        },
      },
      result: {
        data: {
          updateMember: {
            member: {
              ...attendantMember,
              displayName: 'Bruno Souza',
            },
            errors: [],
          },
        },
      },
    };
    render(
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
        <MemberEditDialog member={attendantMember} open onClose={onClose} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('rejects an invalid phone typed on a legacy member', async () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <MemberEditDialog member={attendantMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Telefone inválido.')).toBeInTheDocument();
  });

  it('does not allow clearing an existing phone', async () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <MemberEditDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Este campo é obrigatório.')).toBeInTheDocument();
  });

  it('sends changed phone (normalized), pix, birth date and categories', async () => {
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
            phone: '+551133334444',
            pixKey: 'ana@pix.com',
            birthDate: '1990-05-20T00:00:00.000Z',
            categoryIds: ['cat-1', 'cat-2'],
          },
        },
      },
      result: {
        data: {
          updateMember: {
            member: { ...professionalMember },
            errors: [],
          },
        },
      },
    };
    render(
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
        <MemberEditDialog member={professionalMember} open onClose={onClose} />
      </MockedProvider>,
    );

    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(11) 3333-4444' },
    });
    fireEvent.change(screen.getByLabelText('Chave Pix'), {
      target: { value: 'ana@pix.com' },
    });
    fireEvent.change(screen.getByLabelText('Data de nascimento'), {
      target: { value: '1990-05-20' },
    });
    fireEvent.click(await screen.findByLabelText('Maquiagem'));

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// CreateMemberDialog
// ---------------------------------------------------------------------------

const createdMember = {
  id: 'mem-new',
  displayName: 'Carla Nova',
  email: 'carla@studio.com',
  roleName: 'PROFESSIONAL',
  seniorityTier: null,
  isProfessional: true,
  status: 'active',
  phone: '+5511987654321',
  pixKey: '12345678909',
  birthDate: null,
  categories: [{ id: 'cat-1', name: 'Cabelo' }],
};

async function fillCreateForm(opts: { role?: string } = {}) {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Carla Nova' } });
  fireEvent.change(screen.getByLabelText('E-mail'), {
    target: { value: 'carla@studio.com' },
  });
  fireEvent.change(screen.getByLabelText('Telefone'), {
    target: { value: '(11) 98765-4321' },
  });
  fireEvent.change(screen.getByLabelText('Chave Pix'), {
    target: { value: '123.456.789-09' },
  });
  fireEvent.click(screen.getByRole('combobox', { name: 'Papel' }));
  fireEvent.click(
    await screen.findByRole('option', { name: opts.role ?? 'Profissional' }),
  );
}

describe('CreateMemberDialog', () => {
  it('requires the mandatory fields', async () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={vi.fn()} callerRoleName="ADMIN" />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => {
      expect(screen.getAllByText('Este campo é obrigatório.').length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText('Selecione um papel.')).toBeInTheDocument();
    });
  });

  it('pre-generates a password and the Gerar button replaces it', () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={vi.fn()} callerRoleName="ADMIN" />
      </MockedProvider>,
    );

    const input = screen.getByLabelText('Senha provisória') as HTMLInputElement;
    expect(input.value).toHaveLength(14);
    const before = input.value;
    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    expect((screen.getByLabelText('Senha provisória') as HTMLInputElement).value).not.toBe(before);
  });

  it('MANAGER does not see the ADMIN role option', async () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={vi.fn()} callerRoleName="MANAGER" />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Papel' }));
    expect(await screen.findByRole('option', { name: 'Gerente' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Admin' })).toBeNull();
  });

  it('PROFESSIONAL hides the also-attends checkbox and shows categories; ATTENDANT shows checkbox first', async () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={vi.fn()} callerRoleName="ADMIN" />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Papel' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Atendente' }));
    const checkbox = await screen.findByLabelText('Também atende clientes');
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByText('Categorias atendidas')).toBeNull();

    fireEvent.click(checkbox);
    expect(await screen.findByLabelText('Cabelo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Papel' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Profissional' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Também atende clientes')).toBeNull();
    });
    expect(await screen.findByLabelText('Cabelo')).toBeInTheDocument();
  });

  it('blocks a professional without categories', async () => {
    render(
      <MockedProvider mocks={[categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={vi.fn()} callerRoleName="ADMIN" />
      </MockedProvider>,
    );

    await fillCreateForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText('Escolha ao menos uma categoria que o profissional atende.'),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('submits the mutation, then shows the temporary password once with a copy button', async () => {
    const onClose = vi.fn();
    let sentPassword = '';
    const mock = {
      request: { query: CreateMemberMutation },
      variableMatcher: (vars: { input: Record<string, unknown> }) => {
        sentPassword = vars.input.temporaryPassword as string;
        const { temporaryPassword: _pw, ...rest } = vars.input;
        void _pw;
        expect(rest).toEqual({
          displayName: 'Carla Nova',
          email: 'carla@studio.com',
          phone: '+5511987654321',
          pixKey: '123.456.789-09',
          birthDate: null,
          roleName: 'PROFESSIONAL',
          isProfessional: true,
          categoryIds: ['cat-1'],
        });
        return true;
      },
      result: {
        data: {
          createMember: {
            member: createdMember,
            existingAccount: false,
            warning: null,
            errors: [],
          },
        },
      },
    };
    render(
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={onClose} callerRoleName="ADMIN" />
      </MockedProvider>,
    );

    await fillCreateForm();
    fireEvent.click(await screen.findByLabelText('Cabelo'));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    const shown = await screen.findByTestId('temporary-password');
    expect(shown).toHaveTextContent(sentPassword);
    expect(sentPassword).toHaveLength(14);
    expect(screen.getByText(/Ela não será exibida novamente/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(sentPassword);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('existing account shows the warning and never a password', async () => {
    const mock = {
      request: { query: CreateMemberMutation },
      variableMatcher: () => true,
      result: {
        data: {
          createMember: {
            member: createdMember,
            existingAccount: true,
            warning: 'Essa pessoa já tem conta no SGS e entra com a senha que já usa.',
            errors: [],
          },
        },
      },
    };
    render(
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={vi.fn()} callerRoleName="ADMIN" />
      </MockedProvider>,
    );

    await fillCreateForm();
    fireEvent.click(await screen.findByLabelText('Cabelo'));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText(
        'Essa pessoa já tem conta no SGS e entra com a senha que já usa.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('temporary-password')).toBeNull();
  });

  it('maps a field error (MEMBER_ALREADY_EXISTS) to the email field, not a toast', async () => {
    const mock = {
      request: { query: CreateMemberMutation },
      variableMatcher: () => true,
      result: {
        data: {
          createMember: {
            member: null,
            existingAccount: false,
            warning: null,
            errors: [
              {
                code: 'MEMBER_ALREADY_EXISTS',
                message: 'Essa pessoa já faz parte deste salão.',
                field: 'email',
              },
            ],
          },
        },
      },
    };
    render(
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={vi.fn()} callerRoleName="ADMIN" />
      </MockedProvider>,
    );

    await fillCreateForm();
    fireEvent.click(await screen.findByLabelText('Cabelo'));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText('Essa pessoa já faz parte deste salão.'),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('an error without a field goes to a toast', async () => {
    const mock = {
      request: { query: CreateMemberMutation },
      variableMatcher: () => true,
      result: {
        data: {
          createMember: {
            member: null,
            existingAccount: false,
            warning: null,
            errors: [{ code: 'BOOM', message: 'Algo deu errado.', field: null }],
          },
        },
      },
    };
    render(
      <MockedProvider mocks={[mock, categoriesMock]} addTypename={false}>
        <CreateMemberDialog open onClose={vi.fn()} callerRoleName="ADMIN" />
      </MockedProvider>,
    );

    await fillCreateForm();
    fireEvent.click(await screen.findByLabelText('Cabelo'));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Algo deu errado.');
    });
  });
});

// ---------------------------------------------------------------------------
// ResetMemberPasswordDialog
// ---------------------------------------------------------------------------

describe('ResetMemberPasswordDialog', () => {
  it('asks for confirmation, then shows the new password once with copy', async () => {
    const mock = {
      request: {
        query: ResetMemberPasswordMutation,
        variables: { input: { id: 'mem-1' } },
      },
      result: {
        data: {
          resetMemberPassword: {
            member: { id: 'mem-1' },
            temporaryPassword: 'AbCdEfGhJkMnPq',
            errors: [],
          },
        },
      },
    };
    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <ResetMemberPasswordDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    expect(
      screen.getByText(/precisará trocar a senha no próximo acesso/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar senha' }));

    expect(await screen.findByTestId('temporary-password')).toHaveTextContent(
      'AbCdEfGhJkMnPq',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('AbCdEfGhJkMnPq');
    });
  });

  it('shows a toast and stays on the confirmation on error', async () => {
    const mock = {
      request: {
        query: ResetMemberPasswordMutation,
        variables: { input: { id: 'mem-1' } },
      },
      result: {
        data: {
          resetMemberPassword: {
            member: null,
            temporaryPassword: null,
            errors: [
              {
                code: 'MEMBER_IN_OTHER_ORGANIZATION',
                message: 'Essa pessoa também trabalha em outro salão.',
                field: null,
              },
            ],
          },
        },
      },
    };
    render(
      <MockedProvider mocks={[mock]} addTypename={false}>
        <ResetMemberPasswordDialog member={professionalMember} open onClose={vi.fn()} />
      </MockedProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gerar senha' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Essa pessoa também trabalha em outro salão.');
    });
    expect(screen.queryByTestId('temporary-password')).toBeNull();
    expect(screen.getByRole('button', { name: 'Gerar senha' })).toBeInTheDocument();
  });
});
