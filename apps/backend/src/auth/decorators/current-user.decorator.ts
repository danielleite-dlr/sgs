import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { JwtAccessPayload } from '../types';

/**
 * @CurrentUser() — extracts the authenticated user's JWT payload from the
 * GraphQL execution context. Returns null if request is unauthenticated
 * (e.g., @Public() routes).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtAccessPayload | null => {
    const gql = GqlExecutionContext.create(ctx);
    return (gql.getContext().req?.user as JwtAccessPayload) ?? null;
  },
);
