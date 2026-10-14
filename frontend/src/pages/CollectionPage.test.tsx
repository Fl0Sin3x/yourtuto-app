import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionPage } from './CollectionPage';
import { collectionsApi, type CollectionDetail } from '../api/collections';

const detail: CollectionDetail = {
  id: 1, slug: 'docker-abc123', title: 'Docker essentials', description: null, public: true, tutorialIds: [2, 1], count: 2,
  updatedAt: '2026-10-14T00:00:00+00:00', owner: 'flo', isOwner: false,
  tutorials: [
    { id: 2, slug: 'compose', title: 'Compose', description: null, difficulty: null, source: 'dev', thumbnailUrl: null },
    { id: 1, slug: 'intro', title: 'Intro Docker', description: null, difficulty: 'Débutant', source: 'dev', thumbnailUrl: null },
  ],
};

const renderAt = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={['/c/docker-abc123']}>
      <Routes><Route path="/c/:slug" element={<CollectionPage />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

describe('CollectionPage', () => {
  it('renders a public collection in order with a share button, no owner controls', async () => {
    vi.spyOn(collectionsApi, 'get').mockResolvedValue(detail);
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Docker essentials' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Compose');
    expect(screen.getByRole('link', { name: 'Intro Docker' })).toHaveAttribute('href', '/tutorials/1/intro');
    expect(screen.getByRole('button', { name: /Partager/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows owner controls', async () => {
    vi.spyOn(collectionsApi, 'get').mockResolvedValue({ ...detail, isOwner: true });
    renderAt();
    expect(await screen.findByRole('checkbox', { name: /publique/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Retirer Compose' })).toBeInTheDocument();
  });
});
