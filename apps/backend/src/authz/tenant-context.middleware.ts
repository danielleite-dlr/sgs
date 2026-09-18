import {
  Injectable,
  ExecutionContext,
  NestInterceptor,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import type { JwtAccessPayload } from '../auth/types';

/**
 * TenantContextInterceptor — resolves the active membership from the JWT payload
 * and attaches it as `ctx.tenant` for downstream guards and resolvers.
 *
 * Strategy:
 *  1. If `X-Organization-Id` header is present, validate it against JWT memberships.
 *  2. If the header org is not in the JWT, throw TENANT_MISMATCH (403).
 *  3. If header is absent, default to the first membership (single-org user, common in Phase 1).
 *  4. Unauthenticated requests (no JWT / @Public()) pass through — tenant is null.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const gql = GqlExecutionContext.create(ctx);
    const req = gql.getContext().req as
      | (Request & { user?: JwtAccessPayload; headers: Record<string, string> })
      | undefined;
    const user = req?.user;

    if (user && user.memberships?.length) {
      const headerOrgId = req?.headers?.['x-organization-id'];
      let active = user.memberships[0];

      if (headerOrgId) {
        const matched = user.memberships.find(
          (m) => m.organizationId === headerOrgId,
        );
        if (!matched) {
          const e = new Error(
            'TENANT_MISMATCH: requested organization not in user memberships',
          );
          (e as Error & { extensions?: Record<string, string> }).extensions = {
            code: 'FORBIDDEN',
          };
          throw e;
        }
        active = matched;
      }

      // Cliente suspenso não opera. O status vem do token, então isto pega a
      // sessão aberta depois da suspensão; a de antes morre quando o access
      // token vence, já que a suspensão revoga os refresh tokens do salão.
      // O admin de plataforma escapa: o seletor existe para entrar e resolver.
      if (
        active.organizationStatus &&
        active.organizationStatus !== 'active' &&
        !user.isPlatformAdmin
      ) {
        const e = new Error('ORGANIZATION_SUSPENDED: acesso suspenso');
        (e as Error & { extensions?: Record<string, string> }).extensions = {
          code: 'FORBIDDEN',
        };
        throw e;
      }

      gql.getContext().tenant = {
        organizationId: active.organizationId,
        memberId: active.memberId,
        roleName: active.roleName,
      };
    }

    return next.handle();
  }
}
