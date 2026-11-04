import { FastifyAdapter } from '@nestjs/platform-fastify';

/**
 * Adapter Fastify compartilhado por main.ts e pelos testes de integração.
 * `trustProxy: true` faz `req.ip` refletir o X-Forwarded-For do nginx (IP real da noiva
 * no aceite do contrato, e chave correta do rate limit) em vez do IP do proxy.
 */
export function createFastifyAdapter(opts: { logger?: boolean } = {}): FastifyAdapter {
  return new FastifyAdapter({ logger: opts.logger ?? false, trustProxy: true });
}
