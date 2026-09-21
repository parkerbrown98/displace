"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { getAssetDownload } from "./asset-client";

export function AuthorizedAssetImage({ alt, assetId, placeId }: { alt: string; assetId: string; placeId?: string }) {
  const assetKey = `${placeId ?? "public"}:${assetId}`;
  const [result, setResult] = useState<{ key: string; unavailable?: boolean; url?: string }>();

  useEffect(() => {
    if (!placeId) return;
    let active = true;
    void getAssetDownload(placeId, assetId)
      .then((download) => { if (active) setResult({ key: assetKey, url: download.url }); })
      .catch(() => { if (active) setResult({ key: assetKey, unavailable: true }); });
    return () => { active = false; };
  }, [assetId, assetKey, placeId]);

  if (!placeId || result?.key === assetKey && result.unavailable) return <span className="asset-image-fallback"><ImageOff aria-hidden="true" size={18} />{alt || "Image unavailable"}</span>;
  if (result?.key !== assetKey || !result.url) return <span className="asset-image-loading" role="status">Loading image...</span>;
  // The API resolves authorization and returns an expiring object-store URL.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} className="authorized-asset-image" loading="lazy" src={result.url} />;
}