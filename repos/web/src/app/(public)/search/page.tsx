import { redirect } from "next/navigation";
import { queryValue } from "@/features/public-content/public-query";
import { routes } from "@/lib/routes";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const parameters = await searchParams;
  const destination = new URLSearchParams();
  for (const name of ["cursor", "placeId", "q", "type"] as const) {
    const value = queryValue(parameters[name]);
    if (value) destination.set(name, value);
  }
  redirect(`${routes.discover}${destination.size ? `?${destination.toString()}` : ""}`);
}