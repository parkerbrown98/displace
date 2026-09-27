import type { components } from '@displace/api-client';
import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from '../auth/session-provider';

type AssetDownload = components['schemas']['AssetDownloadDto'];

export function AuthorizedAssetImage({ alt, assetId, placeId }: { alt: string; assetId: string; placeId?: string }) {
  const { client } = useSession();
  const requestKey = `${placeId ?? 'unavailable'}:${assetId}`;
  const [result, setResult] = useState<{ key: string; unavailable?: boolean; url?: string }>();

  useEffect(() => {
    if (!placeId) return;
    let active = true;
    void client.authenticatedRequest<AssetDownload>(`/api/v1/places/${encodeURIComponent(placeId)}/assets/downloads/${encodeURIComponent(assetId)}`)
      .then((download) => { if (active) setResult({ key: requestKey, url: download.url }); })
      .catch(() => { if (active) setResult({ key: requestKey, unavailable: true }); });
    return () => { active = false; };
  }, [assetId, client, placeId, requestKey]);

  if (!placeId || result?.key === requestKey && result.unavailable) return <span className="asset-image-fallback"><ImageOff aria-hidden="true" size={18} />{alt || 'Image unavailable'}</span>;
  if (result?.key !== requestKey || !result.url) return <span className="asset-image-loading" role="status">Loading image...</span>;
  return <img alt={alt} className="authorized-asset-image" loading="lazy" src={result.url} />;
}