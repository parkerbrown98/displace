export interface PlaceScope {
  readonly placeId: string;
}

export function placeScope(placeId: string): PlaceScope {
  return Object.freeze({ placeId });
}
