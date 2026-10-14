import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityHeatmap } from './ActivityHeatmap';

const days = Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, count: i % 5 }));

describe('ActivityHeatmap', () => {
  it('renders one cell per day with intensity levels', () => {
    render(<ActivityHeatmap days={days} />);
    const cells = screen.getAllByTestId('heatmap-cell');
    expect(cells).toHaveLength(14);
    expect(cells[0]).toHaveAttribute('data-level', '0');
    expect(cells[1]).toHaveAttribute('data-level', '1');
    expect(cells[4]).toHaveAttribute('data-level', '3');
  });

  it('exposes an accessible summary', () => {
    render(<ActivityHeatmap days={days} />);
    expect(screen.getByLabelText(/14 derniers jours : 26 tutoriels/)).toBeInTheDocument();
  });
});
