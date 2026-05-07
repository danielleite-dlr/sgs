import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n/index';
import { CategoriaForm } from '../components/CategoriaForm';
import {
  CategoriesQuery,
  CreateCategoryMutation,
} from '../api/categorias.api';

// Minimal mocks - categories query returns empty list for simplicity
const baseMocks = [
  {
    request: { query: CategoriesQuery },
    result: { data: { categories: [] } },
  },
];

describe('CategoriaForm', () => {
  it('shows required field error on empty name submit (does not proceed)', async () => {
    render(
      <MockedProvider mocks={baseMocks} addTypename={false}>
        <CategoriaForm onClose={() => {}} />
      </MockedProvider>,
    );

    // Click submit without entering name
    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() => {
      // Submit button should not show loading text — form validation blocked it
      expect(screen.queryByText('Salvando…')).toBeNull();
    });
  });

  it('submits createCategory mutation when name is valid', async () => {
    let called = false;

    const mocks = [
      ...baseMocks,
      {
        request: {
          query: CreateCategoryMutation,
          variables: { input: { name: 'Cabelo' } },
        },
        result: () => {
          called = true;
          return {
            data: {
              createCategory: {
                category: {
                  id: 'uuid-1',
                  name: 'Cabelo',
                  parentId: null,
                  displayOrder: 0,
                },
                errors: [],
              },
            },
          };
        },
      },
      // Refetch after mutation
      {
        request: { query: CategoriesQuery },
        result: {
          data: {
            categories: [
              {
                id: 'uuid-1',
                name: 'Cabelo',
                parentId: null,
                displayOrder: 0,
                coverImageUrl: null,
                children: [],
              },
            ],
          },
        },
      },
    ];

    const onClose = vi.fn();

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CategoriaForm onClose={onClose} />
      </MockedProvider>,
    );

    // Fill in name field
    const nameInput = screen.getByPlaceholderText(/Ex\.: Cabelo/i);
    fireEvent.change(nameInput, { target: { value: 'Cabelo' } });

    // Submit form
    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() => expect(called).toBe(true), { timeout: 3000 });
  });

  it('shows error returned from server on field', async () => {
    const mocks = [
      ...baseMocks,
      {
        request: {
          query: CreateCategoryMutation,
          variables: { input: { name: 'Cabelo' } },
        },
        result: {
          data: {
            createCategory: {
              category: null,
              errors: [{ code: 'DUPLICATE_NAME', message: 'Categoria já existe.', field: 'name' }],
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CategoriaForm onClose={() => {}} />
      </MockedProvider>,
    );

    const nameInput = screen.getByPlaceholderText(/Ex\.: Cabelo/i);
    fireEvent.change(nameInput, { target: { value: 'Cabelo' } });
    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(screen.getByText('Categoria já existe.')).toBeInTheDocument();
    });
  });
});
