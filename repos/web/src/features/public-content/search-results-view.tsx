import Link from "next/link";
import { ArrowLeft, FileText, MapPin, MessageSquareText, Search } from "lucide-react";
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
  tag?: string;
  type?: "place" | "post" | "topic";
  unavailable?: boolean;
}

export function DiscoveryView({ joinPolicy, page, places, placeId, query, selectedPlace, tag, type, unavailable }: DiscoveryViewProps) {
  const hasQuery = Boolean(query && query.trim().length >= 2);
  return (
    <main className="public-main discovery-page" id="main-content">
      <section className="discovery-hero">
        <div className="discovery-hero-copy">
          <p className="eyebrow">Discover Displace</p>
          <h1>Find your people.<br />Follow the good threads.</h1>
          <p>Search across public communities, topics, and replies, or wander by interest.</p>
        </div>
        <div className="discovery-signal" aria-hidden="true"><span /><span /><span /><strong>D</strong></div>
        <form action={routes.discover} className="discovery-command" method="get" role="search">
          <div className="discovery-query-field">
            <Search aria-hidden="true" size={22} />
            <label className="sr-only" htmlFor="discover-query">Search</label>
            <input autoFocus={Boolean(placeId && !query)} defaultValue={query} id="discover-query" minLength={2} name="q" placeholder={selectedPlace ? `Search in ${selectedPlace.name}` : "Search communities or topics"} required type="search" />
          </div>
          <label className="discovery-select">Result type<select defaultValue={type ?? ""} name="type"><option value="">Everything</option><option value="place">Communities</option><option value="topic">Topics</option><option value="post">Replies</option></select></label>
          <label className="discovery-select">Search scope<select defaultValue={selectedPlace?.id ?? ""} name="placeId"><option value="">Everywhere</option>{selectedPlace ? <option value={selectedPlace.id}>{selectedPlace.name}</option> : null}</select></label>
          <button className="discovery-search-button" type="submit"><Search size={18} aria-hidden="true" />Search</button>
        </form>
        {selectedPlace ? <div className="discovery-scope"><MapPin size={17} aria-hidden="true" /><div><p>Searching within</p><h2>Search in {selectedPlace.name}</h2></div><Link href={routes.discover}>Search everywhere</Link></div> : null}
      </section>

      {hasQuery ? <section className="discovery-results" aria-labelledby="discovery-results-heading">
        <header className="discovery-section-heading"><div><p className="eyebrow">Search results</p><h2 id="discovery-results-heading">Matches for “{query}”</h2></div><Link className="discovery-back-link" href={routes.discover}><ArrowLeft size={16} /> Explore communities</Link></header>
        {unavailable ? <StatusPanel title="Search is unavailable" description="Try again in a little while." tone="error" /> : null}
        {!unavailable && page?.items.length === 0 ? <StatusPanel title="No matches found" description="Try a broader phrase, another result type, or search everywhere." /> : null}
        {page?.items.length ? <div aria-label="Search results" className="search-result-list">
          {page.items.map((result) => (
            <article className="search-result" key={`${result.type}:${result.postId ?? result.topicId ?? result.placeId}`}>
              <div className="search-result-icon" aria-hidden="true">{result.type === "place" ? <MapPin size={18} /> : result.type === "topic" ? <MessageSquareText size={18} /> : <FileText size={18} />}</div>
              <div>
                <p className="eyebrow">{result.type === "place" ? "Community" : result.type === "topic" ? "Topic" : "Reply"} · {result.placeSlug}</p>
                <h3><Link href={result.type === "place" ? routes.place(result.placeSlug) : routes.topic(result.placeSlug, result.topicId!)}>{highlight(result.highlights?.title ?? result.title)}</Link></h3>
                <p>{highlight(result.highlights?.text ?? result.text)}</p>
                <time dateTime={result.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(result.createdAt))}</time>
              </div>
            </article>
          ))}
        </div> : null}
        {page ? <CursorPagination nextCursor={page.nextCursor} parameters={{ placeId, q: query, type }} path={routes.discover} /> : null}
      </section> : null}
      {!hasQuery && places ? <PlaceDirectory joinPolicy={joinPolicy} page={places} tag={tag} /> : null}
      {!hasQuery && !places ? <div className="discovery-results"><StatusPanel title="Places are unavailable" description="Try again in a little while." tone="error" /></div> : null}
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