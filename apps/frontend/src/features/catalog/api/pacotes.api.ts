import { gql } from '@apollo/client';

export const PackagesQuery = gql`
  query Packages {
    packages {
      id
      name
      price
      individualSum
      validForDays
      coverImageUrl
      services {
        serviceId
        quantity
        displayOrder
        service {
          id
          name
          basePrice
        }
      }
      createdAt
      updatedAt
    }
  }
`;

export const CreatePackageMutation = gql`
  mutation CreatePackage($input: CreatePackageInput!) {
    createPackage(input: $input) {
      package {
        id
        name
        price
        individualSum
        services {
          serviceId
          quantity
          displayOrder
          service {
            id
            name
            basePrice
          }
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

export const UpdatePackageMutation = gql`
  mutation UpdatePackage($input: UpdatePackageInput!) {
    updatePackage(input: $input) {
      package {
        id
        name
        price
        individualSum
        services {
          serviceId
          quantity
          displayOrder
          service {
            id
            name
            basePrice
          }
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

export const SoftDeletePackageMutation = gql`
  mutation SoftDeletePackage($input: SoftDeleteInput!) {
    softDeletePackage(input: $input) {
      package {
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

export interface PackageServiceItem {
  serviceId: string;
  quantity: number;
  displayOrder: number;
  service: {
    id: string;
    name: string;
    basePrice: string;
  };
}

export interface PackageData {
  id: string;
  name: string;
  price: string;
  individualSum: string;
  validForDays?: number | null;
  coverImageUrl?: string | null;
  services: PackageServiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PackagePayload {
  package: PackageData | null;
  errors: UserError[];
}

export interface PackagesQueryResult {
  packages: PackageData[];
}

export interface CreatePackageResult {
  createPackage: PackagePayload;
}

export interface UpdatePackageResult {
  updatePackage: PackagePayload;
}

export interface SoftDeletePackageResult {
  softDeletePackage: PackagePayload;
}
