import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { EmailVerificationService } from './email-verification.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * AuthModule — wires all authentication providers.
 *
 * JwtModule is registered without a static secret — TokenService passes the
 * secret per-call via signAsync/verifyAsync options, allowing key separation
 * between access and refresh secrets.
 *
 * JwtAuthGuard is registered as APP_GUARD (global). Use @Public() to opt out
 * on specific resolvers (signup, login, refresh, etc.).
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // secret/expiry passed per-call in TokenService
  ],
  providers: [
    AuthService,
    AuthResolver,
    PasswordService,
    TokenService,
    EmailVerificationService,
    JwtStrategy,
    // Apply JWT guard globally; @Public() opts out
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, TokenService, PasswordService],
})
export class AuthModule {}
