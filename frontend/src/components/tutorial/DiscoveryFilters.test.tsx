import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscoveryFilters } from './DiscoveryFilters';

describe('DiscoveryFilters', () => {
  it('toggles difficulty and marks the active chip', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<DiscoveryFilters difficulty="" sort="" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Avancé' }));
    expect(onChange).toHaveBeenCalledWith({ difficulty: 'avancé' });

    rerender(<DiscoveryFilters difficulty="avancé" sort="" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Avancé' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Avancé' }));
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: '' });
  });

  it('switches sort to popular', async () => {
    const onChange = vi.fn();
    render(<DiscoveryFilters difficulty="" sort="" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Populaires' }));
    expect(onChange).toHaveBeenCalledWith({ sort: 'popular' });
  });
});
