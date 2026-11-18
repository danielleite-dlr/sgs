import { gql } from '@apollo/client';
import type { CommercialOkPayload, CommercialStage, UserError } from './deals.api';

/** SDL em apps/backend/src/graphql/schema/commercial.graphql. */
export interface CommercialStageInput {
  name: string;
  color: string;
  slaDays?: number | null;
}

export interface CommercialStagePayload {
  stage: CommercialStage | null;
  errors: UserError[];
}

export interface CommercialStagesPayload {
  stages: CommercialStage[];
  errors: UserError[];
}

export type { CommercialOkPayload };

const STAGE_FIELDS = `
  id
  name
  color
  position
  slaDays
  kind
  isSystem
  openDeals
`;

export const CreateCommercialStageMutation = gql`
  mutation CreateCommercialStage($input: CommercialStageInput!) {
    createCommercialStage(input: $input) {
      stage {
        ${STAGE_FIELDS}
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateCommercialStageMutation = gql`
  mutation UpdateCommercialStage($id: UUID!, $input: CommercialStageInput!) {
    updateCommercialStage(id: $id, input: $input) {
      stage {
        ${STAGE_FIELDS}
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ReorderCommercialStagesMutation = gql`
  mutation ReorderCommercialStages($ids: [UUID!]!) {
    reorderCommercialStages(ids: $ids) {
      stages {
        ${STAGE_FIELDS}
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const DeleteCommercialStageMutation = gql`
  mutation DeleteCommercialStage($id: UUID!, $moveToStageId: UUID) {
    deleteCommercialStage(id: $id, moveToStageId: $moveToStageId) {
      ok
      errors {
        code
        message
        field
      }
    }
  }
`;
