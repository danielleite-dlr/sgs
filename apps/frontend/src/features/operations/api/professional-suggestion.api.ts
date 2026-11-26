import { gql } from '@apollo/client';

export const SuggestProfessionalsQuery = gql`
  query SuggestProfessionals($serviceId: UUID!, $startsAt: DateTime!, $endsAt: DateTime!) {
    suggestProfessionals(serviceId: $serviceId, startsAt: $startsAt, endsAt: $endsAt) {
      professionalId
      displayName
      isFixed
      free
      dayMinutes
      suggested
    }
  }
`;

export interface ProfessionalSuggestionData {
  professionalId: string;
  displayName: string;
  isFixed: boolean;
  free: boolean;
  dayMinutes: number;
  suggested: boolean;
}

export interface SuggestProfessionalsResult {
  suggestProfessionals: ProfessionalSuggestionData[];
}
