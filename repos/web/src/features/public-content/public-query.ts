export type PublicFeed = "following" | "latest" | "popular";

export function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function publicFeed(value: string | string[] | undefined): PublicFeed {
  const candidate = queryValue(value);
  return candidate === "following" || candidate === "popular" ? candidate : "latest";
}