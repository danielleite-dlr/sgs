import { gql } from '@apollo/client';

export const PackagesQuery = gql`
  query Packages {
    packages {
      id
      name
      price
      individualSum
      validForDays
      depositKind
      depositValue
      contractDescription
      coverImageUrl
      services {
        serviceId
        quantity
        displayOrder
        includesTrial
        service {
          id
          name
          basePrice
        }
        professionalCost
        hasCommissionRule
      }
      costItems {
        id
        name
        cost
        displayOrder
      }
      totalCost
      profit
      profitPercent
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
        depositKind
        depositValue
        contractDescription
        services {
          serviceId
          quantity
          displayOrder
          includesTrial
          service {
            id
            name
            basePrice
          }
          professionalCost
          hasCommissionRule
        }
        costItems {
          id
          name
          cost
          displayOrder
        }
        totalCost
        profit
        profitPercent
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
        depositKind
        depositValue
        contractDescription
        services {
          serviceId
          quantity
          displayOrder
          includesTrial
          service {
            id
            name
            basePrice
          }
          professionalCost
          hasCommissionRule
        }
        costItems {
          id
          name
          cost
          displayOrder
        }
        totalCost
        profit
        profitPercent
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
  /** Teste incluso no valor do pacote, cobrado no evento (261108-n2o). */
  includesTrial: boolean;
  service: {
    id: string;
    name: string;
    basePrice: string;
  };
  /** Repasse à profissional (comissão × qtd). null para quem não edita o catálogo. */
  professionalCost?: string | null;
  hasCommissionRule?: boolean | null;
}

export interface PackageCostItem {
  id: string;
  name: string;
  cost: string;
  displayOrder: number;
}

export interface PackageData {
  id: string;
  name: string;
  price: string;
  individualSum: string;
  validForDays?: number | null;
  depositKind?: 'fixed' | 'percent' | null;
  depositValue?: string | null;
  contractDescription?: string | null;
  coverImageUrl?: string | null;
  services: PackageServiceItem[];
  /** Custos/lucro: null para quem não pode editar o catálogo. */
  costItems?: PackageCostItem[] | null;
  totalCost?: string | null;
  profit?: string | null;
  profitPercent?: string | null;
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
