import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TutorialCard } from './TutorialCard';
import type { Tutorial } from '../../types';

const base: Tutorial = {
  id: 42,
  title: 'Learn React hooks',
  slug: 'learn-react-hooks',
  description: 'A short intro',
  content: null,
  externalUrl: null,
  thumbnailUrl: null,
  source: 'community',
  externalId: null,
  difficulty: 'beginner',
  duration: null,
  viewCount: 1500,
  published: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null,
  author: null,
  categories: [],
  tags: [],
};

const renderCard = (t: Tutorial) => render(<MemoryRouter><TutorialCard tutorial={t} /></MemoryRouter>);

describe('TutorialCard', () => {
  it('links community tutorials to the internal detail page', () => {
    renderCard(base);
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/tutorials/42/learn-react-hooks');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => expect(a).not.toHaveAttribute('target'));
    expect(screen.getByText('Learn React hooks')).toBeInTheDocument();
  });

  it('opens unknown external sources in a new tab', () => {
    renderCard({ ...base, source: 'medium', externalUrl: 'https://medium.com/some-post' });
    const external = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === 'https://medium.com/some-post');
    expect(external.length).toBeGreaterThan(0);
    external.forEach((a) => {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
