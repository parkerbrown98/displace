import { AppShell } from "@/components/app-shell/app-shell";
import { SavedLibrary } from "@/features/forums/saved-library";

export default function SavedPage() {
  return (
    <AppShell activeNavigation="saved">
      <main className="main-content" id="main-content">
        <section className="saved-page"><SavedLibrary /></section>
      </main>
    </AppShell>
  );
}