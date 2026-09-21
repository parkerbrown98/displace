import type { ReactNode } from "react";

interface StatusPanelProps {
  action?: ReactNode;
  description: string;
  title: string;
  tone?: "error" | "neutral" | "pending";
}

export function StatusPanel({
  action,
  description,
  title,
  tone = "neutral",
}: StatusPanelProps) {
  return (
    <section
      className={`status-panel status-panel-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading-panel" role="status" aria-label={label}>
      <span className="skeleton skeleton-title" />
      <span className="skeleton" />
      <span className="skeleton" />
    </div>
  );
}