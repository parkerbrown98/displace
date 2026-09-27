import { Bell, Compass, Home, LogIn, Plus, Search, Settings, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../features/auth/session-provider';
import { notificationTarget, useNotifications } from '../../features/notifications/notification-context';
import { usePlaceClient } from '../../features/places/use-place-client';
import { useRemoteResource } from '../../lib/remote-resource';
import { useConnectivity } from '../../lib/realtime/connectivity';
import { useRealtimeState } from '../../lib/realtime/realtime-context';

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
  const realtimeState = useRealtimeState();
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const inbox = useNotifications();

  useEffect(() => {
    if (session.sessionExpired && location.pathname !== '/session-expired') {
      navigate(`/session-expired?returnTo=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate, session.sessionExpired]);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      navigate('/search');
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, [navigate]);

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
          {session.status === 'authenticated' ? <NavLink to="/notifications" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Bell aria-hidden="true" size={18} /><span>Notifications</span>{inbox.unreadCount ? <strong className="nav-count">{inbox.unreadCount > 99 ? '99+' : inbox.unreadCount}</strong> : null}
          </NavLink> : null}
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
        <div className="activity-heading"><h2>Activity</h2>{session.status === 'authenticated' ? <Link to="/notifications">View all</Link> : null}</div>
        {inbox.notifications.length ? <ol className="activity-list">{inbox.notifications.slice(0, 4).map((notification) => {
          const target = notificationTarget(notification);
          const content = <><strong>{notification.type === 'chat.mention' ? 'Chat mention' : 'New update'}</strong><span>{new Date(notification.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></>;
          return <li className={notification.readAt ? '' : 'unread'} key={notification.id}>{target ? <Link onClick={() => void inbox.markRead(notification.id)} to={target}>{content}</Link> : <div>{content}</div>}</li>;
        })}</ol> : <div className="empty-activity">
          <span className="activity-icon"><Bell aria-hidden="true" size={20} /></span>
          <p>No new activity</p>
          <span>Replies and mentions will appear here.</span>
        </div>}
        {session.status === 'authenticated' ? <p className={`context-connection ${realtimeState}`}><span aria-hidden="true" />{realtimeState === 'connected' ? 'Live updates connected' : realtimeState === 'offline' ? 'Waiting for network' : 'Reconnecting live updates'}</p> : null}
      </aside>
      <div className="offline-banner" hidden={connectivity === 'connected'} role="status">
        <WifiOff aria-hidden="true" size={16} /> Offline
      </div>
    </div>
  );
}
