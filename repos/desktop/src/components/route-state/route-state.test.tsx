import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouteState } from './route-state';

describe('RouteState', () => {
  it('announces loading state', () => {
    render(<RouteState state="loading" title="Loading discussions" />);
    expect(screen.getByText('Loading discussions').closest('section')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders failures as alerts', () => {
    render(<RouteState state="error" message="Connection lost." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Connection lost.');
  });

  it('renders a not-found state without presenting it as a live failure', () => {
    render(<RouteState state="not-found" />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});