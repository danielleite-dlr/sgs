import { Fragment } from 'react';
import { parseBold, splitParagraphs } from '../lib/contract-rich-text';

/**
 * Texto do contrato na tela interna (UX-11): `**negrito**` vira <strong>,
 * linhas em branco separam parágrafos e `\n` simples vira <br />.
 * Mesmo comportamento do ContractDocument (aceite público) e do PDF.
 */
export function ContractTextView({ text }: { text: string }) {
  return (
    <div data-testid="contract-text" className="space-y-sm text-sm text-neutral-700">
      {splitParagraphs(text).map((p, pi) => (
        <p key={pi} className="break-words">
          {p.split('\n').map((line, li) => (
            <Fragment key={li}>
              {li > 0 && <br />}
              {parseBold(line).map((r, ri) =>
                r.bold ? (
                  <strong key={ri} className="font-semibold text-neutral-800">
                    {r.text}
                  </strong>
                ) : (
                  <Fragment key={ri}>{r.text}</Fragment>
                ),
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
