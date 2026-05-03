import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: process.env['VITE_API_URL']
    ? `${process.env['VITE_API_URL']}/graphql`
    : 'http://localhost:3000/graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'],
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: {
        gqlTagName: 'gql',
        fragmentMasking: false,
      },
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        scalars: {
          UUID: 'string',
          DateTime: 'string',
          Date: 'string',
          JSON: 'Record<string, unknown>',
          BigInt: 'string',
        },
      },
    },
  },
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
