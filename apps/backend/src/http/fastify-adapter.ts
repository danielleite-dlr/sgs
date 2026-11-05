import { FastifyAdapter } from '@nestjs/platform-fastify';

/**
 * Adapter Fastify compartilhado por main.ts e pelos testes de integração.
 * `trustProxy: true` faz `req.ip` refletir o X-Forwarded-For do nginx (IP real da noiva
 * no aceite do contrato, e chave correta do rate limit) em vez do IP do proxy.
 * `bodyLimit` de 4 MiB: o papel timbrado sobe como base64 dentro da mutation GraphQL
 * (2,5 MB de imagem viram ~3,4 MB de base64); o padrão do Fastify (1 MiB) daria 413.
 * O nginx já aceita 25m.
 */
export function createFastifyAdapter(opts: { logger?: boolean } = {}): FastifyAdapter {
  return new FastifyAdapter({
    logger: opts.logger ?? false,
    trustProxy: true,
    bodyLimit: 4 * 1024 * 1024,
  });
}
