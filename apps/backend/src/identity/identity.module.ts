import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationService } from './invitation.service';
import { InvitationResolver } from './invitation.resolver';
import { MembersService } from './members.service';
import { MembersResolver } from './members.resolver';

/**
 * IdentityModule — member invitation lifecycle + members query.
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
  providers: [InvitationService, InvitationResolver, MembersService, MembersResolver],
  exports: [InvitationService, MembersService],
})
export class IdentityModule {}
