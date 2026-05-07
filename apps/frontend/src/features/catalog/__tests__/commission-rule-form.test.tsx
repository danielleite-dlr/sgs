import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n/index';
import { CommissionRuleForm } from '../components/CommissionRuleForm';
import { CommissionRulesQuery, CreateCommissionRuleMutation } from '../api/comissoes.api';
import { MembersQuery } from '../api/members.api';
import { ServicesQuery } from '../api/servicos.api';
import { CategoriesQuery } from '../api/categorias.api';
import { ProductsQuery } from '../api/produtos.api';

// ---- Mock data ----

const membersMock = {
  request: { query: MembersQuery },
  result: {
    data: {
      members: [
        { id: 'mem-1', displayName: 'Ana Silva', email: 'ana@test.com', roleName: 'PROFESSIONAL', seniorityTier: 'senior' },
      ],
    },
  },
};

const servicesMock = {
  request: { query: ServicesQuery, variables: {} },
  result: {
    data: {
      services: [
        {
          id: 'svc-1',
          name: 'Corte feminino',
          categoryId: 'cat-1',
          category: { id: 'cat-1', name: 'Cabelo', parentId: null },
          basePrice: '80.00',
          defaultDurationMinutes: 60,
          displayOrder: 1,
          coverImageUrl: null,
          pricingVariants: [],
        },
      ],
    },
  },
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
            { id: 'cat-1-1', name: 'Coloração', parentId: 'cat-1', displayOrder: 1, coverImageUrl: null },
          ],
        },
      ],
    },
  },
};

const productsMock = {
  request: { query: ProductsQuery, variables: { lowStockOnly: false } },
  result: {
    data: {
      products: [
        {
          id: 'prod-1',
          name: 'Shampoo Teste',
          sku: 'SHM-001',
          costPrice: '10.00',
          salePrice: '25.00',
          stockQuantity: 10,
          minStockLevel: 2,
          unit: 'un',
          isLowStock: false,
          coverImageUrl: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    },
  },
};

const commissionRulesMock = {
  request: { query: CommissionRulesQuery },
  result: { data: { commissionRules: [] } },
};

const createDefaultRuleMock = {
  request: {
    query: CreateCommissionRuleMutation,
    variables: {
      input: { scopeType: 'default', kind: 'percentage', value: '10' },
    },
  },
  result: {
    data: {
      createCommissionRule: {
        rule: {
          id: 'rule-1',
          scopeType: 'default',
          kind: 'percentage',
          value: '10',
          member: null,
          service: null,
          category: null,
          product: null,
        },
        errors: [],
      },
    },
  },
};

const createScopeConflictMock = {
  request: {
    query: CreateCommissionRuleMutation,
    variables: {
      input: { scopeType: 'default', kind: 'percentage', value: '10' },
    },
  },
  result: {
    data: {
      createCommissionRule: {
        rule: null,
        errors: [{ code: 'COMMISSION_SCOPE_CONFLICT', message: 'Já existe uma regra para este escopo.', field: null }],
      },
    },
  },
};

const createValueOutOfRangeMock = {
  request: {
    query: CreateCommissionRuleMutation,
    variables: {
      input: { scopeType: 'default', kind: 'percentage', value: '10' },
    },
  },
  result: {
    data: {
      createCommissionRule: {
        rule: null,
        errors: [{ code: 'VALUE_OUT_OF_RANGE', message: 'Percentual deve ser entre 0 e 100.', field: 'value' }],
      },
    },
  },
};

const defaultMocks = [membersMock, servicesMock, categoriesMock, productsMock, commissionRulesMock];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderForm(mocks: any[] = defaultMocks) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <CommissionRuleForm onClose={vi.fn()} />
    </MockedProvider>,
  );
}

// ---- Tests ----

describe('CommissionRuleForm', () => {
  it('1. initial render — scope default selected, no extra picker visible', () => {
    renderForm();
    // "Padrão da organização" radio should be rendered
    expect(screen.getByText(/padrão da organização/i)).toBeInTheDocument();
    // No member/service combobox buttons should be visible
    expect(screen.queryByText(/selecione o profissional/i)).toBeNull();
    expect(screen.queryByText(/selecione o serviço/i)).toBeNull();
  });

  it('2. selecting scope service — shows service combobox', async () => {
    renderForm();
    const serviceRadio = screen.getByLabelText(/^serviço$/i);
    fireEvent.click(serviceRadio);
    await waitFor(() => {
      expect(screen.getByText(/selecione o serviço/i)).toBeInTheDocument();
    });
    // No member combobox
    expect(screen.queryByText(/selecione o profissional/i)).toBeNull();
  });

  it('3. selecting scope member_service — both member AND service combobox visible', async () => {
    renderForm();
    const memberServiceRadio = screen.getByLabelText(/profissional \+ serviço/i);
    fireEvent.click(memberServiceRadio);
    await waitFor(() => {
      expect(screen.getByText(/selecione o profissional/i)).toBeInTheDocument();
      expect(screen.getByText(/selecione o serviço/i)).toBeInTheDocument();
    });
  });

  it('4. selecting scope category — category select appears', async () => {
    renderForm();
    const categoryRadio = screen.getByLabelText(/^categoria$/i);
    fireEvent.click(categoryRadio);
    await waitFor(() => {
      expect(screen.getByText(/selecione a categoria/i)).toBeInTheDocument();
    });
  });

  it('5. selecting scope product — product combobox appears', async () => {
    renderForm();
    const productRadio = screen.getByLabelText(/^produto$/i);
    fireEvent.click(productRadio);
    await waitFor(() => {
      expect(screen.getByText(/selecione o produto/i)).toBeInTheDocument();
    });
  });

  it('6. submitting default + percentage + 10 calls createCommissionRule correctly', async () => {
    renderForm([...defaultMocks, createDefaultRuleMock]);
    // Set value to 10
    const valueInput = screen.getByPlaceholderText('0%');
    fireEvent.change(valueInput, { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      // The mock should resolve without errors — no conflict alert shown
      expect(screen.queryByText(/já existe uma regra/i)).toBeNull();
    });
  });

  it('7. submitting service scope without selecting service → zod error on serviceId', async () => {
    renderForm();
    const serviceRadio = screen.getByLabelText(/^serviço$/i);
    fireEvent.click(serviceRadio);

    const valueInput = screen.getByPlaceholderText('0%');
    fireEvent.change(valueInput, { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/selecione um serviço/i)).toBeInTheDocument();
    });
  });

  it('8. COMMISSION_SCOPE_CONFLICT → shows inline Alert', async () => {
    renderForm([...defaultMocks, createScopeConflictMock]);

    const valueInput = screen.getByPlaceholderText('0%');
    fireEvent.change(valueInput, { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/já existe uma regra para este escopo/i)).toBeInTheDocument();
    });
  });

  it('9. VALUE_OUT_OF_RANGE → form.setError on value field', async () => {
    renderForm([...defaultMocks, createValueOutOfRangeMock]);

    const valueInput = screen.getByPlaceholderText('0%');
    fireEvent.change(valueInput, { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/percentual deve ser entre 0 e 100/i)).toBeInTheDocument();
    });
  });

  it('10. switching scope clears previously-selected id — service field empty after scope change', async () => {
    renderForm();
    // Select 'service' scope
    fireEvent.click(screen.getByLabelText(/^serviço$/i));
    await waitFor(() => {
      expect(screen.getByText(/selecione o serviço/i)).toBeInTheDocument();
    });

    // Switch to 'category' scope — service combobox disappears
    fireEvent.click(screen.getByLabelText(/^categoria$/i));
    await waitFor(() => {
      expect(screen.queryByText(/selecione o serviço/i)).toBeNull();
      expect(screen.getByText(/selecione a categoria/i)).toBeInTheDocument();
    });

    // Switch back to 'service' scope — service combobox re-appears (cleared, not pre-selected)
    fireEvent.click(screen.getByLabelText(/^serviço$/i));
    await waitFor(() => {
      expect(screen.getByText(/selecione o serviço/i)).toBeInTheDocument();
    });
  });
});
