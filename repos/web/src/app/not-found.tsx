import Link from "next/link";
import { StatusPanel } from "@/components/ui/status-panel";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="standalone-state" id="main-content">
      <StatusPanel
        action={<Link className="primary-button" href={routes.home}>Return home</Link>}
        description="This page may have moved or may not be available to you."
        title="Page not found"
      />
    </main>
  );
}