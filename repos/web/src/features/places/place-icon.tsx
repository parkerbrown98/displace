"use client";

import { useEffect, useState } from "react";
import { getAssetDownload, getPlaceImage } from "@/features/assets/asset-client";
import { resolveApiUrl } from "@/lib/api/request";
import type { PlaceContract } from "./place-contract";

interface PlaceIconProps {
  className: string;
  place: Pick<PlaceContract, "id" | "name" | "visibility">;
}

const PLACE_ICON_UPDATED_EVENT = "displace:place-icon-updated";

export function notifyPlaceIconUpdated(placeId: string) {
  window.dispatchEvent(new CustomEvent(PLACE_ICON_UPDATED_EVENT, { detail: { placeId } }));
}

export function PlaceIcon({ className, place }: PlaceIconProps) {
  const [revision, setRevision] = useState(0);
  const imageKey = `${place.id}:${place.visibility}:${revision}`;
  const [privateImage, setPrivateImage] = useState<{ key: string; url?: string }>();
  const [failedUrl, setFailedUrl] = useState<string>();

  useEffect(() => {
    function refreshIcon(event: Event) {
      if (event instanceof CustomEvent && event.detail?.placeId === place.id) {
        setRevision((value) => value + 1);
      }
    }
    window.addEventListener(PLACE_ICON_UPDATED_EVENT, refreshIcon);
    return () => { window.removeEventListener(PLACE_ICON_UPDATED_EVENT, refreshIcon); };
  }, [place.id]);

  useEffect(() => {
    if (place.visibility === "public") return;
    let active = true;
    void getPlaceImage(place.id, "icon")
      .then((reference) => reference.assetId ? getAssetDownload(place.id, reference.assetId) : undefined)
      .then((download) => {
        if (active) setPrivateImage({ key: imageKey, url: download?.url });
      })
      .catch(() => {
        if (active) setPrivateImage({ key: imageKey });
      });
    return () => { active = false; };
  }, [imageKey, place.id, place.visibility]);

  const publicImageUrl = resolveApiUrl("browser", `/public/places/${encodeURIComponent(place.id)}/images/icon`);
  const imageUrl = place.visibility === "public"
    ? `${publicImageUrl}${revision ? `?revision=${revision}` : ""}`
    : privateImage?.key === imageKey ? privateImage.url : undefined;

  if (!imageUrl || failedUrl === imageUrl) {
    return <span className={className} aria-hidden="true">{initials(place.name)}</span>;
  }

  // The source is either a same-API redirect or an authorized expiring URL.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" aria-hidden="true" className={`${className} place-icon-image`} onError={() => setFailedUrl(imageUrl)} src={imageUrl} />;
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}