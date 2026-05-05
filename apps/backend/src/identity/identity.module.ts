import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationService } from './invitation.service';
import { InvitationResolver } from './invitation.resolver';

/**
 * IdentityModule — member invitation lifecycle.
 *
 * Depends on AuthModule for:
 *  - AuthService.issueSession (issue tokens after accept)
 *  - PasswordService.hash (hash new user's password on accept)
 *
 * Depends on DatabaseModule (global) for:
 *  - PrismaService (raw queries + ORM access)
 *  - TenantContextService (runWithTenant transactions)
 *
 * Depends on EmailModule (global) for:
 *  - EmailService.sendInvitation
 */
@Module({
  imports: [AuthModule],
  providers: [InvitationService, InvitationResolver],
  exports: [InvitationService],
})
export class IdentityModule {}
