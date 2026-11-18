import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PublicLeadService } from './public-lead.service';

/** Cabeçalhos de privacidade (o link carrega um segredo). */
const PrivateResponse = () =>
  applyDecorators(
    Header('Cache-Control', 'no-store'),
    Header('X-Robots-Tag', 'noindex'),
    Header('Referrer-Policy', 'no-referrer'),
  );

// @Public(): o JwtAuthGuard global é GraphQL-bound. O ThrottlerGuard usa as opções do
// ThrottlerModule global (registrado em ContractAcceptanceModule); não há novo forRoot aqui.
@Public()
@Controller('public/leads')
@UseGuards(ThrottlerGuard)
export class PublicLeadController {
  constructor(private readonly leads: PublicLeadService) {}

  @Get(':orgId/:token')
  @PrivateResponse()
  view(@Param('orgId') orgId: string, @Param('token') token: string) {
    return this.leads.view(orgId, token);
  }

  @Post(':orgId/:token')
  @HttpCode(201)
  @PrivateResponse()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(@Param('orgId') orgId: string, @Param('token') token: string, @Body() body: unknown) {
    return this.leads.submit(orgId, token, body);
  }
}
