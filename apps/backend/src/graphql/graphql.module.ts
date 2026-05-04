import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { customScalars } from './scalars';

/**
 * GraphqlModule — schema-first GraphQL setup with custom scalars.
 * Uses typePaths to discover all *.graphql SDL files at runtime.
 *
 * Context function exposes the Fastify request (req) and reply (res)
 * for use by the JwtAuthGuard and @CurrentUser() decorator.
 */
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      typePaths: ['./src/**/*.graphql'],
      resolvers: { ...customScalars },
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
    }),
  ],
})
export class GraphqlModule {}
