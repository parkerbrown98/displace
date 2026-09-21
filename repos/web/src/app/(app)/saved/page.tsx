import { AppShell, ShellTopbar } from "@/components/app-shell/app-shell";
import { SavedLibrary } from "@/features/forums/saved-library";

export default function SavedPage() {
  return (
    <AppShell activeNavigation="saved">
      <main className="main-content" id="main-content">
        <ShellTopbar />
        <section className="saved-page">
          <header className="public-page-heading compact-heading"><p className="eyebrow">Library</p><h1>Saved</h1><p>Your saved topics and posts, across every place.</p></header>
          <SavedLibrary />
        </section>
      </main>
    </AppShell>
  );
}