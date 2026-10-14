import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('renders five stars', () => {
    render(<StarRating value={3} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('calls onChange with the clicked star', async () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    await userEvent.click(screen.getAllByRole('button')[3]);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('disables the stars when readonly', () => {
    render(<StarRating value={2} readonly />);
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });
});
