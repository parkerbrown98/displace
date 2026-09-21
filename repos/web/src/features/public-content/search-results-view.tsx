import Link from "next/link";
import { FileText, MessageSquareText, Search } from "lucide-react";
import { CursorPagination } from "@/components/ui/cursor-pagination";
import { StatusPanel } from "@/components/ui/status-panel";
import { routes } from "@/lib/routes";
import type { SearchPageContract } from "./public-contracts";

interface SearchResultsViewProps {
  page?: SearchPageContract;
  placeId?: string;
  query?: string;
  type?: "place" | "post" | "topic";
  unavailable?: boolean;
}

export function SearchResultsView({ page, placeId, query, type, unavailable }: SearchResultsViewProps) {
  const hasQuery = Boolean(query && query.trim().length >= 2);
  return (
    <main className="public-main search-page" id="main-content">
      <header className="public-page-heading">
        <p className="eyebrow">Search</p>
        <h1>Discussion results</h1>
        <p>Find public topics and replies across Displace communities.</p>
      </header>
      <form className="search-filters" method="get" role="search">
        <label className="form-field">Search discussions<input defaultValue={query} minLength={2} name="q" placeholder="Try a topic, phrase, or reply" required type="search" /></label>
        <label className="form-field">Result type<select defaultValue={type ?? ""} name="type"><option value="">All public content</option><option value="place">Places</option><option value="topic">Topics</option><option value="post">Replies</option></select></label>
        <label className="form-field">Place ID<input defaultValue={placeId} name="placeId" placeholder="Optional place ID" /></label>
        <button className="secondary-button" type="submit"><Search size={16} aria-hidden="true" />Search</button>
      </form>
      {!hasQuery ? <StatusPanel title="Search public discussions" description="Enter at least two characters to search topics and replies." /> : null}
      {hasQuery && unavailable ? <StatusPanel title="Search is unavailable" description="Try again in a little while." tone="error" /> : null}
      {hasQuery && !unavailable && page?.items.length === 0 ? <StatusPanel title="No matching discussions" description="Try a more general phrase or remove a filter." /> : null}
      {page?.items.length ? <section aria-label="Search results" className="search-result-list">
        {page.items.map((result) => (
          <article className="search-result" key={`${result.type}:${result.postId ?? result.topicId}`}>
            <div className="search-result-icon" aria-hidden="true">{result.type === "topic" ? <MessageSquareText size={18} /> : <FileText size={18} />}</div>
            <div>
              <p className="eyebrow">{result.type === "place" ? "Place" : result.type === "topic" ? "Topic" : "Reply"} in {result.placeSlug}</p>
              <h2><Link href={result.type === "place" ? routes.place(result.placeSlug) : routes.topic(result.placeSlug, result.topicId!)}>{highlight(result.highlights?.title ?? result.title)}</Link></h2>
              <p>{highlight(result.highlights?.text ?? result.text)}</p>
              <time dateTime={result.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(result.createdAt))}</time>
            </div>
          </article>
        ))}
      </section> : null}
      {page ? <CursorPagination nextCursor={page.nextCursor} parameters={{ placeId, q: query, type }} path={routes.search} /> : null}
    </main>
  );
}

function highlight(value: string) {
  return value.split(/(<mark>|<\/mark>)/g).reduce<React.ReactNode[]>((parts, part, index, source) => {
    if (!part || part === "<mark>" || part === "</mark>") return parts;
    const marked = source[index - 1] === "<mark>";
    parts.push(marked ? <mark key={`${part}-${index}`}>{part}</mark> : part);
    return parts;
  }, []);
}