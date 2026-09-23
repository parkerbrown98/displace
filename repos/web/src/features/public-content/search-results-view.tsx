import Link from "next/link";
import { FileText, MapPin, MessageSquareText, Search } from "lucide-react";
import { CursorPagination } from "@/components/ui/cursor-pagination";
import { StatusPanel } from "@/components/ui/status-panel";
import type { PlaceContract, PlacePageContract } from "@/features/places/place-contract";
import { routes } from "@/lib/routes";
import type { SearchPageContract } from "./public-contracts";
import { PlaceDirectory } from "./public-views";

interface DiscoveryViewProps {
  joinPolicy?: string;
  page?: SearchPageContract;
  places?: PlacePageContract;
  placeId?: string;
  query?: string;
  selectedPlace?: PlaceContract;
  type?: "place" | "post" | "topic";
  unavailable?: boolean;
}

export function DiscoveryView({ joinPolicy, page, places, placeId, query, selectedPlace, type, unavailable }: DiscoveryViewProps) {
  const hasQuery = Boolean(query && query.trim().length >= 2);
  return (
    <main className="public-main search-page" id="main-content">
      <header className="public-page-heading">
        <p className="eyebrow">Discover</p>
        <h1>Find communities and conversations</h1>
        <p>Search public places, topics, and replies across Displace.</p>
      </header>
      <form action={routes.discover} className="search-filters" method="get" role="search">
        <label className="form-field">Search<input autoFocus={Boolean(placeId && !query)} defaultValue={query} minLength={2} name="q" placeholder={selectedPlace ? `Search in ${selectedPlace.name}` : "Try a community, topic, or reply"} required type="search" /></label>
        <label className="form-field">Result type<select defaultValue={type ?? ""} name="type"><option value="">All public content</option><option value="place">Places</option><option value="topic">Topics</option><option value="post">Replies</option></select></label>
        <label className="form-field">Search scope<select defaultValue={selectedPlace?.id ?? ""} name="placeId"><option value="">Everywhere</option>{selectedPlace ? <option value={selectedPlace.id}>{selectedPlace.name}</option> : null}</select></label>
        <button className="secondary-button" type="submit"><Search size={16} aria-hidden="true" />Search</button>
      </form>
      {!hasQuery && selectedPlace ? <StatusPanel title={`Search in ${selectedPlace.name}`} description="Enter at least two characters to search this place's topics and replies." /> : null}
      {hasQuery && unavailable ? <StatusPanel title="Search is unavailable" description="Try again in a little while." tone="error" /> : null}
      {hasQuery && !unavailable && page?.items.length === 0 ? <StatusPanel title="No matches found" description="Try a more general phrase or search everywhere." /> : null}
      {page?.items.length ? <section aria-label="Search results" className="search-result-list">
        {page.items.map((result) => (
          <article className="search-result" key={`${result.type}:${result.postId ?? result.topicId ?? result.placeId}`}>
            <div className="search-result-icon" aria-hidden="true">{result.type === "place" ? <MapPin size={18} /> : result.type === "topic" ? <MessageSquareText size={18} /> : <FileText size={18} />}</div>
            <div>
              <p className="eyebrow">{result.type === "place" ? "Place" : result.type === "topic" ? "Topic" : "Reply"} in {result.placeSlug}</p>
              <h2><Link href={result.type === "place" ? routes.place(result.placeSlug) : routes.topic(result.placeSlug, result.topicId!)}>{highlight(result.highlights?.title ?? result.title)}</Link></h2>
              <p>{highlight(result.highlights?.text ?? result.text)}</p>
              <time dateTime={result.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(result.createdAt))}</time>
            </div>
          </article>
        ))}
      </section> : null}
      {page ? <CursorPagination nextCursor={page.nextCursor} parameters={{ placeId, q: query, type }} path={routes.discover} /> : null}
      {!hasQuery && places ? <PlaceDirectory joinPolicy={joinPolicy} page={places} /> : null}
      {!hasQuery && !places ? <StatusPanel title="Places are unavailable" description="Try again in a little while." tone="error" /> : null}
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