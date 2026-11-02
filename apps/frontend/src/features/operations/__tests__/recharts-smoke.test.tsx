import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Bar, BarChart, XAxis } from 'recharts';

describe('Recharts sob React 19', () => {
  it('renderiza barras', () => {
    const { container } = render(
      <BarChart
        width={400}
        height={200}
        data={[
          { d: '01', v: 10 },
          { d: '02', v: 20 },
        ]}
      >
        <XAxis dataKey="d" />
        <Bar dataKey="v" isAnimationActive={false} />
      </BarChart>,
    );
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBeGreaterThanOrEqual(1);
  });
});
