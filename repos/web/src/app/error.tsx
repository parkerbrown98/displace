"use client";

import { StatusPanel } from "@/components/ui/status-panel";

export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="standalone-state" id="main-content">
      <StatusPanel
        action={<button className="primary-button" onClick={reset} type="button">Try again</button>}
        description="The page could not be loaded."
        title="Something went wrong"
        tone="error"
      />
    </main>
  );
}