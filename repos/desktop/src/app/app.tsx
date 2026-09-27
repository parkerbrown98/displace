import { ArrowRight, Clock3, MessageSquareText, Users } from 'lucide-react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '../components/app-shell/app-shell';
import { FeedbackProvider } from '../components/ui/feedback';
import { useToast } from '../components/ui/feedback-context';
import { RouteState } from '../components/route-state/route-state';

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteState state="error" />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'discover', element: <EmptyRoute title="Discover places" /> },
      { path: 'search', element: <EmptyRoute title="Search Displace" /> },
      { path: 'settings', element: <EmptyRoute title="Settings" /> },
      { path: '*', element: <RouteState state="not-found" /> },
    ],
  },
]);

export function App() {
  return (
    <FeedbackProvider>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <RouterProvider router={router} />
    </FeedbackProvider>
  );
}

function HomeRoute() {
  const notify = useToast();
  return (
    <div className="home-view">
      <section className="welcome-band">
        <div>
          <span className="eyebrow">Your communities</span>
          <h2>Pick up where you left off.</h2>
          <p>Recent conversations and saved places stay close at hand.</p>
        </div>
        <button className="button primary" onClick={() => notify('Place discovery opens in Phase 3.')}>Browse places <ArrowRight aria-hidden="true" size={16} /></button>
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

function EmptyRoute({ title }: { title: string }) {
  return <RouteState state="loading" title={`${title} is getting ready`} />;
}