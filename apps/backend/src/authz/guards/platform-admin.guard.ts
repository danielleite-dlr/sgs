import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../../database/prisma.service';
import type { JwtAccessPayload } from '../../auth/types';

/**
 * PlatformAdminGuard — só deixa passar quem é platform admin.
 *
 * Roda depois do JwtAuthGuard global, então request.user já existe. A flag vem
 * no JWT, mas o guard reconfere no banco: um acesso revogado continuaria valendo
 * até o access token expirar (15m), e esse é justamente o caminho mais sensível
 * do sistema — ele enxerga todos os clientes.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const gqlCtx = GqlExecutionContext.create(ctx).getContext() as {
      req?: { user?: JwtAccessPayload };
    };
    const user = gqlCtx.req?.user;
    if (!user?.sub) {
      throw new ForbiddenException('FORBIDDEN: authentication required');
    }

    const row = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isPlatformAdmin: true },
    });
    if (!row?.isPlatformAdmin) {
      throw new ForbiddenException('FORBIDDEN: platform admin only');
    }
    return true;
  }
}
