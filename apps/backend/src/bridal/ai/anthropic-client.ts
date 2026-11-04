import Anthropic from '@anthropic-ai/sdk';
import type { Provider } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';

/** Parte mínima do SDK usada pela sugestão de agenda (facilita o fake nos testes). */
export interface AnthropicLike {
  messages: {
    parse(args: unknown): Promise<{
      parsed_output?: unknown;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
}

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

/** Sem `ANTHROPIC_API_KEY` o cliente é `null` e o serviço usa a heurística. */
export const anthropicClientProvider: Provider = {
  provide: ANTHROPIC_CLIENT,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): AnthropicLike | null => {
    const apiKey = config.anthropicApiKey;
    if (!apiKey) return null;
    return new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 }) as unknown as AnthropicLike;
  },
};
