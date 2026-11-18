import { gql } from '@apollo/client';
import type { UserError } from './deals.api';

/** SDL em apps/backend/src/graphql/schema/commercial-win.graphql. */
export interface CommercialWinClientInput {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  rg?: string | null;
  birthDate?: string | null;
  postalCode?: string | null;
  address?: string | null;
  phone2?: string | null;
  phone3?: string | null;
}

export interface WinCommercialDealInput {
  dealId: string;
  client: CommercialWinClientInput;
  beneficiaryName?: string | null;
  depositPaid: boolean;
  depositLines?: { method: string; amount: string }[] | null;
  discountDescription?: string | null;
}

export interface CommercialWinPayload {
  contractId: string | null;
  clientId: string | null;
  errors: UserError[];
}

export const WinCommercialDealMutation = gql`
  mutation WinCommercialDeal($input: WinCommercialDealInput!) {
    winCommercialDeal(input: $input) {
      contractId
      clientId
      errors {
        code
        message
        field
      }
    }
  }
`;
