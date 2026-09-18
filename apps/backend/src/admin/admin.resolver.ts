import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PlatformAdminGuard } from '../authz/guards/platform-admin.guard';
import { PlatformAdmin } from '../authz/decorators/platform-admin.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/types';

/**
 * AdminResolver — painel de plataforma: cadastro e acompanhamento de clientes.
 *
 * O guard vale para a classe inteira: nada aqui é público e nada aqui é
 * acessível a um usuário de salão, mesmo que ele seja ADMIN da organização dele.
 */
@Resolver()
@PlatformAdmin()
@UseGuards(PlatformAdminGuard)
export class AdminResolver {
  constructor(private readonly admin: AdminService) {}

  @Query('adminClients')
  adminClients(@CurrentUser() user: JwtAccessPayload) {
    return this.admin.listClients(user.sub);
  }

  @Mutation('adminCreateClient')
  adminCreateClient(
    @Args('input')
    input: {
      salonName: string;
      ownerName: string;
      ownerEmail: string;
      password: string;
      segment?: string;
    },
  ) {
    return this.admin.createClient(input);
  }
}
