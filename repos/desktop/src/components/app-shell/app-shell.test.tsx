import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('../../features/auth/session-provider', () => ({ useSession: mocks.useSession }));
vi.mock('../../features/places/use-place-client', () => ({
  usePlaceClient: () => ({ mine: mocks.mine }),
}));
vi.mock('../../lib/realtime/connectivity', () => ({ useConnectivity: () => 'connected' }));

describe('AppShell sidebar', () => {
  beforeEach(() => {
    mocks.mine.mockResolvedValue({
      items: [{ memberCount: 42, name: 'Studio', slug: 'studio' }],
    });
    mocks.useSession.mockReturnValue({
      sessionExpired: false,
      status: 'authenticated',
      user: { displayName: 'Parker', email: 'parker@example.test' },
    });
  });

  it('shows the create shortcut and highlights the active place', async () => {
    render(
      <MemoryRouter initialEntries={['/places/studio/topics/welcome']}>
        <Routes>
          <Route path="*" element={<AppShell />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Create a place' })).toHaveAttribute('href', '/places/new');
    expect(await screen.findByRole('link', { name: /Studio/ })).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(mocks.mine).toHaveBeenCalledOnce();
  });
});