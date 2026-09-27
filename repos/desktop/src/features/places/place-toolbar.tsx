import { Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Place, PlaceContext } from './place-client';

type PlaceSection = 'forums' | 'live' | 'members' | 'settings';

const managementPermissions: PlaceContext['viewer']['permissions'][number][] = [
  'place.manage',
  'member.manage',
  'role.manage',
  'forum.manage',
  'chat.manage',
  'voice.manage',
];

export function PlaceToolbar({ action, active, context, place }: { action?: ReactNode; active: PlaceSection; context?: PlaceContext; place: Place }) {
  const showSettings = context?.viewer.permissions.some((permission) => managementPermissions.includes(permission)) ?? false;
  return <header className="place-toolbar">
    <Link className="place-toolbar-identity" to={`/places/${place.slug}`}>
      <span className="place-toolbar-mark" aria-hidden="true">{initials(place.name)}</span>
      <span><strong>{place.name}</strong><small>{place.memberCount.toLocaleString()} {place.memberCount === 1 ? 'member' : 'members'}</small></span>
    </Link>
    <div className="place-toolbar-end">
      <nav aria-label={`${place.name} navigation`}>
        <PlaceLink active={active === 'forums'} to={`/places/${place.slug}`}>Forums</PlaceLink>
        {context ? <PlaceLink active={active === 'live'} to={`/places/${place.slug}/live`}>Live</PlaceLink> : null}
        {context ? <PlaceLink active={active === 'members'} to={`/places/${place.slug}/members`}>Members</PlaceLink> : null}
        {showSettings ? <PlaceLink active={active === 'settings'} to={`/places/${place.slug}/settings`}><Settings size={14} />Settings</PlaceLink> : null}
      </nav>
      {action ? <div className="place-toolbar-action">{action}</div> : null}
    </div>
  </header>;
}

function PlaceLink({ active, children, to }: { active: boolean; children: React.ReactNode; to: string }) {
  return <Link aria-current={active ? 'page' : undefined} className={active ? 'active' : undefined} to={to}>{children}</Link>;
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}