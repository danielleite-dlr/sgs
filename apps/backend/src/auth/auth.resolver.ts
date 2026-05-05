import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtAccessPayload } from './types';

/**
 * AuthResolver — GraphQL resolver for all authentication mutations and the `me` query.
 *
 * All auth mutations are marked @Public() so they bypass JwtAuthGuard.
 * The `me` query requires a valid JWT (protected by JwtAuthGuard via APP_GUARD).
 */
@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Mutation('signup')
  signup(
    @Args('input')
    input: {
      fullName: string;
      email: string;
      password: string;
      salonName: string;
      segment?: string;
    },
  ) {
    return this.auth.signup(input);
  }

  @Public()
  @Mutation('verifyEmail')
  verifyEmail(@Args('input') input: { token: string }) {
    return this.auth.verifyEmail(input.token);
  }

  @Public()
  @Mutation('resendVerification')
  resendVerification(@Args('input') input: { email: string }) {
    return this.auth.resendVerification(input.email);
  }

  @Public()
  @Mutation('login')
  login(@Args('input') input: { email: string; password: string }) {
    return this.auth.login(input.email, input.password);
  }

  @Public()
  @Mutation('refreshSession')
  refresh(@Args('input') input: { refreshToken: string }) {
    return this.auth.refresh(input.refreshToken);
  }

  @Public()
  @Mutation('logout')
  logout(@Args('input') input: { refreshToken: string }) {
    return this.auth.logout(input.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Query('me')
  me(@CurrentUser() user: JwtAccessPayload) {
    return this.auth.getSession(user.sub);
  }
}
