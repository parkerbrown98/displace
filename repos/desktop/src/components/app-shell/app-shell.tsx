import { Bell, Compass, Home, LogIn, Plus, Search, Settings, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../features/auth/session-provider';
import { usePlaceClient } from '../../features/places/use-place-client';
import { useRemoteResource } from '../../lib/remote-resource';
import { useConnectivity } from '../../lib/realtime/connectivity';

const navigation = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Discover', path: '/discover', icon: Compass },
  { label: 'Search', path: '/search', icon: Search },
];

function placeInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '#';
}

function SidebarPlaces() {
  const client = usePlaceClient();
  const { state, reload } = useRemoteResource('sidebar-places', () => client.mine());

  if (state.status === 'loading') {
    return <p className="sidebar-places-note">Loading places...</p>;
  }

  if (state.status === 'error') {
    return (
      <p className="sidebar-places-note">
        Places unavailable. <button type="button" onClick={reload}>Retry</button>
      </p>
    );
  }

  if (state.data.items.length === 0) {
    return <p className="sidebar-places-note">Your communities will appear here.</p>;
  }

  return (
    <nav className="sidebar-place-list" aria-label="Your places">
      {state.data.items.map((place) => (
        <NavLink
          className={({ isActive }) => `sidebar-place${isActive ? ' active' : ''}`}
          key={place.slug}
          to={`/places/${place.slug}`}
        >
          <span className="sidebar-place-mark" aria-hidden="true">{placeInitial(place.name)}</span>
          <span className="sidebar-place-copy">
            <strong>{place.name}</strong>
            <small>{place.memberCount.toLocaleString()} members</small>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const connectivity = useConnectivity();
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();

  useEffect(() => {
    if (session.sessionExpired && location.pathname !== '/session-expired') {
      navigate(`/session-expired?returnTo=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate, session.sessionExpired]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand" aria-label="Displace">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>Displace</span>
        </div>
        <nav className="nav-list">
          {navigation.map(({ icon: Icon, label, path }) => (
            <NavLink key={path} to={path} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <section className="sidebar-places">
          <div className="sidebar-section-heading">
            <span>Your places</span>
            <Link className="sidebar-add-place" to="/places/new" aria-label="Create a place" title="Create a place">
              <Plus aria-hidden="true" size={14} strokeWidth={2.4} />
            </Link>
          </div>
          {session.status === 'authenticated'
            ? <SidebarPlaces />
            : <p className="sidebar-places-note"><Link to="/sign-in">Sign in</Link> to see your communities.</p>}
        </section>
        <div className="sidebar-footer">
          {session.status === 'authenticated' ? <NavLink to="/settings" className="nav-item">
            <Settings aria-hidden="true" size={18} /><span>Settings</span>
          </NavLink> : <NavLink to="/sign-in" className="nav-item"><LogIn aria-hidden="true" size={18} /><span>Sign in</span></NavLink>}
        </div>
      </aside>
      <main className="workspace" id="main-content">
        <div className="route-content">
          <Outlet />
        </div>
      </main>
      <aside className="context-panel" aria-label="Activity">
        <h2>Activity</h2>
        <div className="empty-activity">
          <span className="activity-icon"><Bell aria-hidden="true" size={20} /></span>
          <p>No new activity</p>
          <span>Replies and mentions will appear here.</span>
        </div>
      </aside>
      <div className="offline-banner" hidden={connectivity === 'connected'} role="status">
        <WifiOff aria-hidden="true" size={16} /> Offline
      </div>
    </div>
  );
}
