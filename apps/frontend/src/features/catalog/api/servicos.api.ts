import { gql } from '@apollo/client';

export const ServicesQuery = gql`
  query Services($categoryId: UUID) {
    services(categoryId: $categoryId) {
      id
      name
      categoryId
      category {
        id
        name
        parentId
      }
      basePrice
      defaultDurationMinutes
      displayOrder
      coverImageUrl
      pricingVariants {
        id
        name
        durationMinutes
        seniorityTier
        price
        displayOrder
      }
    }
  }
`;

export const CreateServiceMutation = gql`
  mutation CreateService($input: CreateServiceInput!) {
    createService(input: $input) {
      service {
        id
        name
        categoryId
        basePrice
        defaultDurationMinutes
        pricingVariants {
          id
          name
          durationMinutes
          seniorityTier
          price
          displayOrder
        }
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateServiceMutation = gql`
  mutation UpdateService($input: UpdateServiceInput!) {
    updateService(input: $input) {
      service {
        id
        name
        categoryId
        basePrice
        defaultDurationMinutes
        pricingVariants {
          id
          name
          durationMinutes
          seniorityTier
          price
          displayOrder
        }
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const SoftDeleteServiceMutation = gql`
  mutation SoftDeleteService($input: SoftDeleteInput!) {
    softDeleteService(input: $input) {
      service {
        id
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

// ---- TypeScript response shapes ----

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

export type SeniorityTier = 'junior' | 'pleno' | 'senior' | null;

export interface ServicePricingVariant {
  id: string;
  name: string;
  durationMinutes: number;
  seniorityTier: SeniorityTier;
  price: string;
  displayOrder: number;
}

export interface ServiceData {
  id: string;
  name: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    parentId: string | null;
  } | null;
  basePrice: string;
  defaultDurationMinutes: number;
  displayOrder: number;
  coverImageUrl?: string | null;
  pricingVariants: ServicePricingVariant[];
}

export interface ServicesQueryResult {
  services: ServiceData[];
}

export interface ServicePayload {
  service: ServiceData | null;
  errors: UserError[];
}

export interface CreateServiceResult {
  createService: ServicePayload;
}

export interface UpdateServiceResult {
  updateService: ServicePayload;
}

export interface SoftDeleteServiceResult {
  softDeleteService: ServicePayload;
}
