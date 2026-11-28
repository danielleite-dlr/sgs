import { fireEvent, screen } from '@testing-library/react';

/** Abre o SearchableSelect pelo testId e clica na opção (espera a lista carregar). */
export async function pickSearchable(testId: string, value: string): Promise<void> {
  fireEvent.click(screen.getByTestId(testId));
  fireEvent.click(await screen.findByTestId(`${testId}-option-${value}`));
}
