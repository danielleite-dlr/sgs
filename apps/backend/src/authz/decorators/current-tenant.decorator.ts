import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface TenantContext {
  organizationId: string;
  memberId: string;
  roleName: string;
}

export const CurrentTenant = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): TenantContext | null => {
    const gql = GqlExecutionContext.create(ctx);
    return (gql.getContext().tenant as TenantContext) ?? null;
  },
);
