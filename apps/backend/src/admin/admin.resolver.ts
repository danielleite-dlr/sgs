import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PlatformAdminGuard } from '../authz/guards/platform-admin.guard';
import { PlatformAdmin } from '../authz/decorators/platform-admin.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';
import type { JwtAccessPayload } from '../auth/types';

/**
 * AdminResolver — painel de plataforma: cadastro e acompanhamento de clientes.
 *
 * O PlatformAdminGuard vale para a classe inteira. As operações mais sensíveis
 * — entrar no salão de um cliente e mexer em acesso de plataforma — pedem
 * permissão extra, conferida no banco a cada chamada e não pelo JWT: um token
 * emitido antes da revogação continuaria valendo por até 15 minutos.
 */
@Resolver()
@PlatformAdmin()
@UseGuards(PlatformAdminGuard)
export class AdminResolver {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Query('adminClients')
  adminClients(@CurrentUser() user: JwtAccessPayload) {
    return this.admin.listClients(user.sub);
  }

  @Mutation('adminCreateClient')
  adminCreateClient(
    @CurrentUser() user: JwtAccessPayload,
    @Args('input')
    input: {
      salonName: string;
      ownerName: string;
      ownerEmail: string;
      segment?: string;
    },
  ) {
    return this.admin.createClient(user.sub, input);
  }

  @Mutation('adminUpdateClient')
  adminUpdateClient(
    @CurrentUser() user: JwtAccessPayload,
    @Args('input')
    input: {
      organizationId: string;
      tradeName?: string;
      legalName?: string;
      email?: string;
      phone?: string | null;
      segment?: string;
      ownerName?: string;
    },
  ) {
    return this.admin.updateClient(user.sub, input);
  }

  @Mutation('adminSetClientStatus')
  adminSetClientStatus(
    @CurrentUser() user: JwtAccessPayload,
    @Args('input')
    input: { organizationId: string; status: 'active' | 'suspended' },
  ) {
    return this.admin.setClientStatus(
      user.sub,
      input.organizationId,
      input.status,
    );
  }

  @Mutation('adminResetClientPassword')
  adminResetClientPassword(
    @CurrentUser() user: JwtAccessPayload,
    @Args('input') input: { organizationId: string },
  ) {
    return this.admin.resetClientPassword(user.sub, input.organizationId);
  }

  @Mutation('adminSwitchToClient')
  async adminSwitchToClient(
    @CurrentUser() user: JwtAccessPayload,
    @Args('input') input: { organizationId: string },
  ) {
    await this.requireClientAccess(user.sub);
    return this.admin.switchToClient(
      { userId: user.sub, email: user.email },
      input.organizationId,
    );
  }

  @Query('adminPlatformUsers')
  async adminPlatformUsers(@CurrentUser() user: JwtAccessPayload) {
    await this.requireMaster(user.sub);
    return this.admin.listPlatformUsers(user.sub);
  }

  @Mutation('adminSetPlatformAccess')
  async adminSetPlatformAccess(
    @CurrentUser() user: JwtAccessPayload,
    @Args('input')
    input: {
      userId: string;
      isPlatformAdmin: boolean;
      canAccessClientOrgs: boolean;
    },
  ) {
    await this.requireMaster(user.sub);
    return this.admin.setPlatformAccess(user.sub, input);
  }

  private async requireMaster(userId: string): Promise<void> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformMaster: true },
    });
    if (!row?.isPlatformMaster) {
      throw new ForbiddenException('FORBIDDEN: platform master only');
    }
  }

  private async requireClientAccess(userId: string): Promise<void> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformMaster: true, canAccessClientOrgs: true },
    });
    if (!row?.isPlatformMaster && !row?.canAccessClientOrgs) {
      throw new ForbiddenException(
        'FORBIDDEN: sem permissão para acessar o salão de um cliente',
      );
    }
  }
}
