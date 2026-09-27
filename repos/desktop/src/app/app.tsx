import { ArrowRight, Clock3, MessageSquareText, Users } from 'lucide-react';
import { useState } from 'react';
import { createHashRouter, Link, RouterProvider } from 'react-router-dom';
import { AppShell } from '../components/app-shell/app-shell';
import { FeedbackProvider } from '../components/ui/feedback';
import { RouteState } from '../components/route-state/route-state';
import type { AppConfig } from '../config/app-config';
import { AccountSettingsRoute } from '../features/auth/account-settings';
import { NativeAuthClient } from '../features/auth/auth-client';
import { ForgotPasswordRoute, RegisterRoute, ResetPasswordRoute, SessionExpiredRoute, SignInRoute, VerifyEmailRoute } from '../features/auth/identity-routes';
import { SessionProvider } from '../features/auth/session-provider';
import { DiscoverRoute, PlaceRoute, ProfileRoute, SearchRoute, TopicRoute } from '../features/places/browse-routes';
import { CreatePlaceRoute, PlaceSettingsRoute } from '../features/places/management-routes';
import { createNativePlatform, type NativePlatform } from '../lib/platform/native-platform';

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteState state="error" />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'discover', element: <DiscoverRoute /> },
      { path: 'search', element: <SearchRoute /> },
      { path: 'places/new', element: <CreatePlaceRoute /> },
      { path: 'places/:placeSlug', element: <PlaceRoute /> },
      { path: 'places/:placeSlug/forums/:forumId', element: <PlaceRoute /> },
      { path: 'places/:placeSlug/topics/:topicId', element: <TopicRoute /> },
      { path: 'places/:placeSlug/settings', element: <PlaceSettingsRoute /> },
      { path: 'members/:handle', element: <ProfileRoute /> },
      { path: 'sign-in', element: <SignInRoute /> },
      { path: 'register', element: <RegisterRoute /> },
      { path: 'verify-email', element: <VerifyEmailRoute /> },
      { path: 'forgot-password', element: <ForgotPasswordRoute /> },
      { path: 'reset-password', element: <ResetPasswordRoute /> },
      { path: 'session-expired', element: <SessionExpiredRoute /> },
      { path: 'settings', element: <AccountSettingsRoute /> },
      { path: '*', element: <RouteState state="not-found" /> },
    ],
  },
]);

export function App({ config, platform = createNativePlatform(), fetchImplementation }: { config: AppConfig; platform?: NativePlatform; fetchImplementation?: typeof fetch }) {
  const [client] = useState(() => new NativeAuthClient(config, platform, fetchImplementation));
  return (
    <FeedbackProvider>
      <SessionProvider client={client}>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <RouterProvider router={router} />
      </SessionProvider>
    </FeedbackProvider>
  );
}

function HomeRoute() {
  return (
    <div className="home-view">
      <section className="welcome-band">
        <div>
          <span className="eyebrow">Your communities</span>
          <h2>Pick up where you left off.</h2>
          <p>Recent conversations and saved places stay close at hand.</p>
        </div>
        <Link className="button primary" to="/discover">Browse places <ArrowRight aria-hidden="true" size={16} /></Link>
      </section>
      <section className="metric-row" aria-label="Overview">
        <div><Users aria-hidden="true" size={18} /><strong>0</strong><span>Places</span></div>
        <div><MessageSquareText aria-hidden="true" size={18} /><strong>0</strong><span>Unread</span></div>
        <div><Clock3 aria-hidden="true" size={18} /><strong>None</strong><span>Recent activity</span></div>
      </section>
      <section className="content-section">
        <div className="section-heading"><h2>Recent discussions</h2><span>Updated just now</span></div>
        <div className="empty-list"><MessageSquareText aria-hidden="true" size={24} /><p>Your recent discussions will appear here.</p></div>
      </section>
    </div>
  );
}
