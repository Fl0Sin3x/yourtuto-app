import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatsPage } from './StatsPage';
import { statsApi } from '../api/stats';

describe('StatsPage', () => {
  it('renders KPIs, labelled breakdowns and most viewed links', async () => {
    vi.spyOn(statsApi, 'overview').mockResolvedValue({
      totals: { tutorials: 1234, newThisWeek: 12, views: 50000, paths: 4, publicCollections: 3, learners: 7, completionsWeek: 9 },
      bySource: [{ label: 'youtube', count: 800 }], byDifficulty: [{ label: 'beginner', count: 10 }],
      topTags: [{ label: 'docker', count: 42 }], mostViewed: [{ id: 5, slug: 'k8s', title: 'Kubernetes 101', viewCount: 999 }],
      generatedAt: '2026-10-14T00:00:00+00:00',
    });
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><StatsPage /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('Tutoriels')).toBeInTheDocument();
    expect(screen.getByText(/1\s234/)).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kubernetes 101' })).toHaveAttribute('href', '/tutorials/5/k8s');
  });
});
