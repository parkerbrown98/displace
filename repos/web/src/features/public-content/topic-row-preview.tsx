"use client";

import { MessageSquareText } from "lucide-react";
import { useState } from "react";
import { resolveApiUrl } from "@/lib/api/request";

export function TopicRowPreview({
  placeId,
  previewImage,
}: {
  placeId: string;
  previewImage: { alt: string; assetId: string } | null;
}) {
  const [failed, setFailed] = useState(false);

  if (!previewImage || failed) {
    return <span aria-label="Text discussion" className="topic-row-preview topic-row-preview-icon"><MessageSquareText aria-hidden="true" size={24} /></span>;
  }

  return (
    <span className="topic-row-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={previewImage.alt}
        loading="lazy"
        onError={() => setFailed(true)}
        src={resolveApiUrl("browser", `/public/places/${encodeURIComponent(placeId)}/images/posts/${encodeURIComponent(previewImage.assetId)}`)}
      />
    </span>
  );
}