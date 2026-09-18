import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminResolver } from './admin.resolver';
import { PlatformAdminGuard } from '../authz/guards/platform-admin.guard';
import { AuthModule } from '../auth/auth.module';

/**
 * AdminModule — painel de plataforma (cadastro e acompanhamento de clientes).
 *
 * Depende do AuthModule pelo PasswordService, que é quem gera o hash Argon2id
 * da senha inicial do cliente.
 */
@Module({
  imports: [AuthModule],
  providers: [AdminService, AdminResolver, PlatformAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
