/** Lucro = preço − custo total; % sobre o preço do pacote. */
export function computeProfit(totalCost: string | number, packagePrice: string | number) {
  const cost = Number(totalCost) || 0;
  const price = Number(packagePrice) || 0;
  const profit = price - cost;
  const percent = price === 0 ? 0 : (profit / price) * 100;
  return { cost, price, profit, percent };
}
