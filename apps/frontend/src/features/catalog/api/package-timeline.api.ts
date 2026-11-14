import { gql } from '@apollo/client';
import type { UserError } from './pacotes.api';

export const PackageTimelineQuery = gql`
  query PackageTimeline($packageId: UUID!) {
    packageTimeline(packageId: $packageId) {
      id
      displayOrder
      isExtra
      name
      offsetMinutes
      kind
      serviceId
      durationMinutes
      startsRegistry
    }
  }
`;

export const SetPackageTimelineMutation = gql`
  mutation SetPackageTimeline($input: SetPackageTimelineInput!) {
    setPackageTimeline(input: $input) {
      steps {
        id
        displayOrder
        isExtra
        name
        offsetMinutes
        kind
        serviceId
        durationMinutes
        startsRegistry
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export type PackageTimelineKind = 'make' | 'hair';

export interface PackageTimelineStepData {
  id: string;
  displayOrder: number;
  isExtra: boolean;
  name: string;
  offsetMinutes: number;
  kind: PackageTimelineKind | null;
  serviceId: string | null;
  durationMinutes: number | null;
  startsRegistry: boolean;
}

export interface PackageTimelineStepInput {
  isExtra: boolean;
  name: string;
  offsetMinutes: number;
  kind?: PackageTimelineKind | null;
  serviceId?: string | null;
  durationMinutes?: number | null;
  startsRegistry?: boolean;
}

export interface PackageTimelineQueryResult {
  packageTimeline: PackageTimelineStepData[];
}

export interface SetPackageTimelineResult {
  setPackageTimeline: {
    steps: PackageTimelineStepData[];
    errors: UserError[];
  };
}
