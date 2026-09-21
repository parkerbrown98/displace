import { PublicShell } from "./public-shell";

export function PublicLoading() {
  return (
    <PublicShell>
      <main className="public-main" id="main-content">
        <div className="public-loading" role="status" aria-label="Loading public content">
          <span className="skeleton skeleton-title" />
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </main>
    </PublicShell>
  );
}