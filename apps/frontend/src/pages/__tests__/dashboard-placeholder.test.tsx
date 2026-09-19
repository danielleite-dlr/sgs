import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DashboardPlaceholder } from '@/pages/DashboardPlaceholder';

describe('DashboardPlaceholder', () => {
  it('does not show a trial or subscription call to action to salon users', () => {
    render(
      <MemoryRouter>
        <DashboardPlaceholder />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Resumo do mês' })).toBeInTheDocument();
    expect(screen.queryByText(/Seu teste grátis termina/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Assinar agora' })).not.toBeInTheDocument();
  });
});
