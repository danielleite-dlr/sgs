import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminResolver } from './admin.resolver';
import { PlatformAdminGuard } from '../authz/guards/platform-admin.guard';
import { AuthModule } from '../auth/auth.module';

/**
 * AdminModule — painel de plataforma (cadastro e acompanhamento de clientes).
 *
 * Depende do AuthModule pelo PasswordService (hash Argon2id da senha gerada) e
 * pelo TokenService (token da sessão dentro do salão do cliente).
 */
@Module({
  imports: [AuthModule],
  providers: [AdminService, AdminResolver, PlatformAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
