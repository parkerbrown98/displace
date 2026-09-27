import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../../components/ui/feedback';
import { MemoryNativePlatform } from '../../lib/platform/native-platform';
import { NativeAuthClient, type Authentication } from './auth-client';
import { ForgotPasswordRoute, SignInRoute } from './identity-routes';
import { SessionProvider } from './session-provider';

const config = { apiOrigin: 'https://api.example.test', oidcCallbackScheme: 'displace-test' };
const authentication: Authentication = {
  accessToken: 'access-token',
  expiresInSeconds: 900,
  refreshToken: 'refresh-token-that-is-long-enough-for-api',
  user: {
    displayName: 'Parker',
    email: 'parker@example.test',
    emailVerified: true,
    handle: 'parker',
    id: 'user-1',
    isInstanceAdmin: false,
  },
};

describe('identity routes', () => {
  it('restores an internal destination after sign-in', async () => {
    const user = userEvent.setup();
    renderIdentity(
      <SignInRoute />,
      '/sign-in?returnTo=%2Fsettings',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(authentication)),
    );

    await user.type(screen.getByLabelText('Email or handle'), 'parker');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Settings destination' })).toBeInTheDocument();
  });

  it('does not navigate to a protocol-relative return target', async () => {
    const user = userEvent.setup();
    renderIdentity(
      <SignInRoute />,
      '/sign-in?returnTo=%2F%2Fevil.example',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(authentication)),
    );

    await user.type(screen.getByLabelText('Email or handle'), 'parker');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Home destination' })).toBeInTheDocument();
  });

  it('shows a generic password recovery confirmation', async () => {
    const user = userEvent.setup();
    renderIdentity(
      <ForgotPasswordRoute />,
      '/forgot-password',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ message: 'This account exists.' })),
    );

    await user.type(screen.getByLabelText('Email'), 'parker@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('If the account exists, a reset message has been sent.')).toBeInTheDocument();
    expect(screen.queryByText('This account exists.')).not.toBeInTheDocument();
  });
});

function renderIdentity(route: React.ReactNode, initialEntry: string, fetchImplementation: typeof fetch) {
  const client = new NativeAuthClient(config, new MemoryNativePlatform(), fetchImplementation);
  return render(
    <FeedbackProvider>
      <SessionProvider client={client}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/sign-in" element={route} />
            <Route path="/forgot-password" element={route} />
            <Route path="/settings" element={<h1>Settings destination</h1>} />
            <Route path="/" element={<h1>Home destination</h1>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </FeedbackProvider>,
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status: 200 });
}