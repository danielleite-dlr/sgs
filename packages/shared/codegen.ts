import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: ['../../apps/backend/src/**/*.graphql'],
  documents: ['src/graphql/**/*.ts'],
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        onlyOperationTypes: true,
        enumsAsTypes: true,
        useTypeImports: true,
        scalars: { UUID: 'string', DateTime: 'string', Date: 'string', Email: 'string', JSON: 'Record<string, unknown>' },
      },
    },
  },
};

export default config;
