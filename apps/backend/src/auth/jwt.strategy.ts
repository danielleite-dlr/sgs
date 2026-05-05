import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import type { JwtAccessPayload } from './types';

/**
 * JwtStrategy — validates Bearer JWT access tokens using HS256 + JWT_SECRET.
 * Passport stores the validated payload in request.user for @CurrentUser().
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtAccessPayload): Promise<JwtAccessPayload> {
    return payload;
  }
}
