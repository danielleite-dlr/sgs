import { gql } from '@apollo/client';

export const LowStockCountQuery = gql`
  query LowStockCount {
    lowStockCount
  }
`;

export const ProductsQuery = gql`
  query Products($lowStockOnly: Boolean) {
    products(lowStockOnly: $lowStockOnly) {
      id
      name
      sku
      costPrice
      salePrice
      stockQuantity
      minStockLevel
      unit
      isLowStock
      coverImageUrl
      createdAt
      updatedAt
    }
  }
`;

export const CreateProductMutation = gql`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      product {
        id
        name
        sku
        costPrice
        salePrice
        stockQuantity
        minStockLevel
        unit
        isLowStock
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateProductMutation = gql`
  mutation UpdateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      product {
        id
        name
        sku
        costPrice
        salePrice
        stockQuantity
        minStockLevel
        unit
        isLowStock
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const AdjustStockMutation = gql`
  mutation AdjustStock($input: AdjustStockInput!) {
    adjustStock(input: $input) {
      product {
        id
        name
        stockQuantity
        minStockLevel
        unit
        isLowStock
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const SoftDeleteProductMutation = gql`
  mutation SoftDeleteProduct($input: SoftDeleteProductInput!) {
    softDeleteProduct(input: $input) {
      product {
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

export type ProductUnit = 'un' | 'ml' | 'g';

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface ProductData {
  id: string;
  name: string;
  sku: string;
  costPrice: string;
  salePrice: string;
  stockQuantity: number;
  minStockLevel: number;
  unit: ProductUnit;
  isLowStock: boolean;
  coverImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPayload {
  product: ProductData | null;
  errors: UserError[];
}

export interface ProductsQueryResult {
  products: ProductData[];
}

export interface LowStockCountResult {
  lowStockCount: number;
}

export interface CreateProductResult {
  createProduct: ProductPayload;
}

export interface UpdateProductResult {
  updateProduct: ProductPayload;
}

export interface AdjustStockResult {
  adjustStock: ProductPayload;
}

export interface SoftDeleteProductResult {
  softDeleteProduct: ProductPayload;
}
