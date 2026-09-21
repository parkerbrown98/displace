import type { ReactNode } from "react";
import { AppShell, ShellTopbar } from "@/components/app-shell/app-shell";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="public-shell">
        <ShellTopbar />
        {children}
      </div>
    </AppShell>
  );
}