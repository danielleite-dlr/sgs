---
quick_id: 261127-vmx
status: complete
commits: [2138eae, 7421289]
---

# Resumo

- **Busca em Serviço e Pacote**: novo `SearchableSelect` (`components/ui/searchable-select.tsx`) com o visual do select nativo; ao abrir mostra campo "Buscar serviço…"/"Buscar pacote…". Filtro em `lib/search-text.ts`: ignora acento e maiúscula, aceita palavras em qualquer ordem ("madrinhas make" acha "Make & Penteado (madrinhas)"). Variante de preço segue como select nativo.
- **Nome do estabelecimento no menu**: ícone `Store` à esquerda e texto em caixa alta (`uppercase`, sem alterar o dado).
- Testes: unitário novo do componente; testes do modal e do menu ajustados; helper `pickSearchable` (vitest e Playwright).

## Gate
lint e typecheck ok; vitest 1258/1258; build ok; E2E da agenda 17/17 (fluxo-agendamento-comanda-pagamento, agenda-concorrencia, prioridade-profissionais, assistente-papel, cronograma-noiva). Backend e consultas GraphQL inalterados.
