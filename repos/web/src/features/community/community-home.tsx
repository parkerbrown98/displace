import Link from "next/link";
import { Plus, Users } from "lucide-react";
import type { CommunityFixture } from "./community-fixtures";
import { TopicList } from "./topic-list";
import { routes } from "@/lib/routes";
import { ShellTopbar } from "@/components/app-shell/app-shell";

export function CommunityHome({ fixture }: { fixture: CommunityFixture }) {
  return (
    <main className="main-content" id="main-content">
      <ShellTopbar />
      <section className="community-header">
        <div>
          <p className="eyebrow">Place / Public</p>
          <h1>{fixture.place.name}</h1>
          <p className="community-description">{fixture.place.description}</p>
        </div>
        <div className="community-stats" aria-label="Community statistics">
          <span><Users size={16} /> {fixture.place.memberCount} members</span>
          <span className="online-status">{fixture.place.onlineCount} online</span>
        </div>
      </section>

      <div className="content-toolbar">
        <nav className="topic-tabs" aria-label="Topic filters">
          <Link className="active" href={`${routes.place(fixture.place.slug)}?feed=latest`}>Latest</Link>
          <Link href={`${routes.place(fixture.place.slug)}?feed=popular`}>Popular</Link>
          <Link href={`${routes.place(fixture.place.slug)}?feed=following`}>Following</Link>
        </nav>
        <Link className="primary-button" href={routes.createTopic(fixture.place.slug)}>
          <Plus size={18} /> New topic
        </Link>
      </div>

      <TopicList placeSlug={fixture.place.slug} topics={fixture.topics} />
    </main>
  );
}