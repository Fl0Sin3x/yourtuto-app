import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SummaryCard } from './SummaryCard';
import { apiClient } from '../../api/client';

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe('SummaryCard', () => {
  it('labels AI summaries', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { points: ['Point A', 'Point B'], source: 'ai', cached: true } });
    wrap(<SummaryCard tutorialId={1} />);
    expect(await screen.findByText('En bref (résumé IA)')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the extractive outline as "Au programme"', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { points: ['Installer', 'Configurer'], source: 'extractive', cached: false } });
    wrap(<SummaryCard tutorialId={2} />);
    expect(await screen.findByText('Au programme')).toBeInTheDocument();
  });
});
