import Link from "next/link";
import type { CommunityFixture } from "./community-fixtures";
import { Avatar } from "@/components/ui/avatar";
import { StatusPanel } from "@/components/ui/status-panel";
import { routes } from "@/lib/routes";

interface TopicListProps {
  placeSlug: string;
  topics: CommunityFixture["topics"];
}

export function TopicList({ placeSlug, topics }: TopicListProps) {
  return (
    <section className="topic-list" aria-labelledby="topics-heading">
      <div className="list-heading">
        <h2 id="topics-heading">Recent discussions</h2>
        <span>Updated now</span>
      </div>
      {topics.length === 0 ? (
        <StatusPanel title="No discussions yet" description="New topics will appear here." />
      ) : topics.map((topic) => (
        <article className="topic-row" key={topic.slug}>
          <span className={`unread-marker${topic.unread ? " visible" : ""}`} />
          <div className="topic-copy">
            <div className="topic-title-row">
              <Link href={routes.topic(placeSlug, topic.slug)}>{topic.title}</Link>
              <span className="category-tag">{topic.category}</span>
            </div>
            <p>{topic.excerpt}</p>
            <div className="topic-byline">
              <Avatar initials={topic.initials} size="small" />
              <span>{topic.author}</span>
              <span aria-hidden="true">·</span>
              <time>{topic.updated}</time>
            </div>
          </div>
          <dl className="topic-metrics">
            <div><dt>Replies</dt><dd>{topic.replies}</dd></div>
            <div><dt>Views</dt><dd>{topic.views}</dd></div>
          </dl>
        </article>
      ))}
    </section>
  );
}