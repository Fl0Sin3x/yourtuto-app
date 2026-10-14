import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar';

describe('Navbar mobile menu', () => {
  it('toggles the mobile links with an accessible burger', async () => {
    render(<MemoryRouter><Navbar /></MemoryRouter>);
    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('mobile-nav')).toBeNull();

    await userEvent.click(burger);
    const panel = document.getElementById('mobile-nav')!;
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent('Parcours');
    expect(panel).toHaveTextContent('Connexion');
    expect(screen.getByRole('button', { name: 'Fermer le menu' })).toHaveAttribute('aria-expanded', 'true');
  });
});
