import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageSkeleton } from './PageSkeleton';

describe('PageSkeleton', () => {
  it('is announced to assistive tech as loading', () => {
    render(<PageSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });
});
