import type { Metadata } from "next";

export function createPublicMetadata({
  description,
  path,
  title,
}: {
  description: string;
  path: string;
  title: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      description,
      siteName: "Displace",
      title,
      type: "website",
      url: path,
    },
  };
}

export const unavailableMetadata: Metadata = {
  title: "Unavailable",
  robots: { follow: false, index: false },
};