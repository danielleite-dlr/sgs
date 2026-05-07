import { gql } from '@apollo/client';

export const CategoriesQuery = gql`
  query Categories {
    categories {
      id
      name
      parentId
      displayOrder
      coverImageUrl
      children {
        id
        name
        parentId
        displayOrder
        coverImageUrl
      }
    }
  }
`;

export const CreateCategoryMutation = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      category {
        id
        name
        parentId
        displayOrder
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateCategoryMutation = gql`
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      category {
        id
        name
        parentId
        displayOrder
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ReorderCategoryMutation = gql`
  mutation ReorderCategory($input: ReorderCategoryInput!) {
    reorderCategory(input: $input) {
      category {
        id
        displayOrder
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const SoftDeleteCategoryMutation = gql`
  mutation SoftDeleteCategory($input: SoftDeleteInput!) {
    softDeleteCategory(input: $input) {
      category {
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

export interface CategoryData {
  id: string;
  name: string;
  parentId: string | null;
  displayOrder: number;
  coverImageUrl?: string | null;
  children?: CategoryData[];
}

export interface CategoriesQueryResult {
  categories: CategoryData[];
}

export interface CategoryPayload {
  category: CategoryData | null;
  errors: UserError[];
}

export interface CreateCategoryResult {
  createCategory: CategoryPayload;
}

export interface UpdateCategoryResult {
  updateCategory: CategoryPayload;
}

export interface ReorderCategoryResult {
  reorderCategory: CategoryPayload;
}

export interface SoftDeleteCategoryResult {
  softDeleteCategory: CategoryPayload;
}
