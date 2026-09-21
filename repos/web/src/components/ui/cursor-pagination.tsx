import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface CursorPaginationProps {
  nextCursor?: string;
  path: string;
  parameters?: Record<string, string | undefined>;
}

export function CursorPagination({ nextCursor, parameters = {}, path }: CursorPaginationProps) {
  if (!nextCursor) return null;
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(parameters)) {
    if (value) query.set(name, value);
  }
  query.set("cursor", nextCursor);

  return (
    <nav className="cursor-pagination" aria-label="Pagination">
      <Link className="secondary-button" href={`${path}?${query.toString()}`}>
        Older results <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </nav>
  );
}