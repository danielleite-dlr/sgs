import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

// @Public(): sem isso o JwtAuthGuard global intercepta a rota e o Passport
// quebra em requisições REST sob o adapter Fastify (req.logIn é undefined),
// devolvendo 500 no healthcheck.
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
