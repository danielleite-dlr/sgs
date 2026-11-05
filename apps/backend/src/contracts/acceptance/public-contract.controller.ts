import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

// fastify não é dependência direta: tipos estruturais mínimos do que usamos.
interface HttpReq {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}
interface HttpRes {
  header(name: string, value: string): unknown;
}
import { Public } from '../../auth/decorators/public.decorator';
import { ContractAcceptanceService, type AcceptBody } from './contract-acceptance.service';
import { ContractPdfService } from './contract-pdf.service';

/** Cabeçalhos de privacidade nas respostas (o link carrega um segredo). */
const PrivateResponse = () =>
  applyDecorators(
    Header('Cache-Control', 'no-store'),
    Header('X-Robots-Tag', 'noindex'),
    Header('Referrer-Policy', 'no-referrer'),
  );

// @Public(): o JwtAuthGuard global é GraphQL-bound (ver health.controller.ts).
// Rate limit só neste controller (ThrottlerGuard local, não global).
@Public()
@Controller('public/contracts')
@UseGuards(ThrottlerGuard)
export class PublicContractController {
  constructor(
    private readonly acceptance: ContractAcceptanceService,
    private readonly pdf: ContractPdfService,
  ) {}

  @Get(':orgId/:token')
  @PrivateResponse()
  view(@Param('orgId') orgId: string, @Param('token') token: string) {
    return this.acceptance.view(orgId, token);
  }

  @Post(':orgId/:token/accept')
  @PrivateResponse()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  accept(
    @Param('orgId') orgId: string,
    @Param('token') token: string,
    @Body() body: AcceptBody,
    @Req() req: HttpReq,
  ) {
    const ua = req.headers['user-agent'];
    return this.acceptance.accept(orgId, token, body ?? {}, {
      ip: req.ip,
      userAgent: typeof ua === 'string' ? ua : null,
    });
  }

  @Get(':orgId/:token/pdf')
  @PrivateResponse()
  async download(
    @Param('orgId') orgId: string,
    @Param('token') token: string,
    @Res({ passthrough: true }) res: HttpRes,
  ) {
    const data = await this.acceptance.pdfDataForToken(orgId, token);
    const buffer = await this.pdf.render(data);
    void res.header('Content-Type', 'application/pdf');
    void res.header('Content-Disposition', `attachment; filename="${data.fileName ?? `contrato-${data.code}.pdf`}"`);
    return buffer;
  }
}
