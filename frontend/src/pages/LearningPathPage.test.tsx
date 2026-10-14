import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LearningPathPage } from './LearningPathPage';
import { pathsApi, type PathDetail } from '../api/paths';

const detail: PathDetail = {
  slug: 'backend-api', title: 'Backend & APIs', description: 'APIs robustes', level: null, icon: '⚙️',
  stepCount: 2, completed: 1, percent: 50, nextStepId: 2,
  steps: [
    { id: 1, slug: 'intro', title: 'Intro REST', description: null, difficulty: 'Débutant', duration: '10 min', source: 'dev', thumbnailUrl: null, done: true },
    { id: 2, slug: 'auth', title: 'Auth JWT', description: null, difficulty: 'Intermédiaire', duration: null, source: 'dev', thumbnailUrl: null, done: false },
  ],
};

describe('LearningPathPage', () => {
  it('shows ordered steps, progress and the next step CTA', async () => {
    vi.spyOn(pathsApi, 'get').mockResolvedValue(detail);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/paths/backend-api']}>
          <Routes><Route path="/paths/:slug" element={<LearningPathPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: /Backend & APIs/ })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progression du parcours' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('link', { name: /Continuer : Auth JWT/ })).toHaveAttribute('href', '/tutorials/2/auth');
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Intro REST');
    expect(screen.getByLabelText('Terminé')).toBeInTheDocument();
  });
});
