import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/infrastructure/i18n/index';
import { PackagePriceSummary } from '../components/PackagePriceSummary';

describe('PackagePriceSummary', () => {
  it('shows discount when package price below individual sum', () => {
    render(<PackagePriceSummary individualSum="280.00" packagePrice="220.00" />);
    expect(screen.getByText(/Soma individual/)).toBeInTheDocument();
    expect(screen.getByText(/Preço do pacote/)).toBeInTheDocument();
    expect(screen.getByText(/de desconto/)).toBeInTheDocument();
  });
  it('shows above when package price above individual sum', () => {
    render(<PackagePriceSummary individualSum="100.00" packagePrice="150.00" />);
    expect(screen.getByText(/acima do total individual/)).toBeInTheDocument();
  });
  it('shows nothing when equal', () => {
    render(<PackagePriceSummary individualSum="100.00" packagePrice="100.00" />);
    expect(screen.queryByText(/acima/)).toBeNull();
    expect(screen.queryByText(/desconto/)).toBeNull();
  });
});
