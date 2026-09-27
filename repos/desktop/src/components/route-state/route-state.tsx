import { AlertTriangle, LoaderCircle, SearchX } from 'lucide-react';

type RouteStateProps =
  | { state: 'loading'; title?: string }
  | { state: 'error'; title?: string; message?: string; onRetry?: () => void }
  | { state: 'not-found'; title?: string; message?: string };

export function RouteState(props: RouteStateProps) {
  if (props.state === 'loading') {
    return (
      <section className="route-state" aria-live="polite" aria-busy="true">
        <LoaderCircle className="spin" aria-hidden="true" size={28} />
        <h2>{props.title ?? 'Loading'}</h2>
      </section>
    );
  }

  const notFound = props.state === 'not-found';
  const Icon = notFound ? SearchX : AlertTriangle;
  return (
    <section className="route-state" role={notFound ? undefined : 'alert'}>
      <Icon aria-hidden="true" size={30} />
      <h2>{props.title ?? (notFound ? 'Page not found' : 'Something went wrong')}</h2>
      <p>{props.message ?? (notFound ? 'This location does not exist.' : 'The page could not be loaded.')}</p>
      {!notFound && props.onRetry ? <button className="button primary" onClick={props.onRetry}>Try again</button> : null}
    </section>
  );
}