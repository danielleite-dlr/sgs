import type { AnthropicLike } from '../../../src/bridal/ai/anthropic-client';

type Responder = (args: unknown) => unknown | Promise<unknown>;

/** Cliente Anthropic falso: nenhuma chamada de rede; respostas enfileiradas pelo teste. */
export class FakeAnthropic implements AnthropicLike {
  calls: unknown[] = [];
  next: Responder[] = [];

  messages = {
    parse: async (args: unknown) => {
      this.calls.push(args);
      const f = this.next.shift();
      if (!f) throw new Error('no fake response');
      return (await f(args)) as {
        parsed_output?: unknown;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
    },
  };

  /** Enfileira uma resposta com saída estruturada (objeto ou função do prompt enviado). */
  respondWith(proposal: unknown | ((args: unknown) => unknown), tokens = { in: 1200, out: 800 }) {
    this.next.push((args) => ({
      parsed_output: typeof proposal === 'function' ? proposal(args) : proposal,
      usage: { input_tokens: tokens.in, output_tokens: tokens.out },
    }));
    return this;
  }

  /** Enfileira uma falha da API. */
  failWith(err: Error) {
    this.next.push(() => {
      throw err;
    });
    return this;
  }

  /** Conteúdo (JSON do contexto) enviado na chamada `i`. */
  contentOf(i: number): string {
    const call = this.calls[i] as { messages: { content: string }[] };
    return call.messages[0].content;
  }
}
