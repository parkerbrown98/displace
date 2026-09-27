import { Bell, Compass, Home, Search, Settings, WifiOff } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useConnectivity } from '../../lib/realtime/connectivity';

const navigation = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Discover', path: '/discover', icon: Compass },
  { label: 'Search', path: '/search', icon: Search },
];

export function AppShell() {
  const connectivity = useConnectivity();

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
        <div className="sidebar-footer">
          <NavLink to="/settings" className="nav-item">
            <Settings aria-hidden="true" size={18} />
            <span>Settings</span>
          </NavLink>
        </div>
      </aside>
      <main className="workspace" id="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Desktop</span>
            <h1>Home</h1>
          </div>
          <div className="topbar-actions">
            <span className="connection-state">
              <span className={`status-dot ${connectivity}`} />
              {connectivity === 'connected' ? 'Connected' : 'Offline'}
            </span>
            <button className="icon-button" aria-label="Notifications"><Bell aria-hidden="true" size={18} /></button>
          </div>
        </header>
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