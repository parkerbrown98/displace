import type { PlaceContract } from "./place-contract";

export interface PlaceViewModel {
  id: string;
  name: string;
  slug: string;
  description: string;
  isArchived: boolean;
  isPublic: boolean;
  joinPolicy: PlaceContract["joinPolicy"];
}

export function toPlaceViewModel(place: PlaceContract): PlaceViewModel {
  return {
    id: place.id,
    name: place.name,
    slug: place.slug,
    description: place.description,
    isArchived: place.archivedAt !== null,
    isPublic: place.visibility === "public",
    joinPolicy: place.joinPolicy,
  };
}