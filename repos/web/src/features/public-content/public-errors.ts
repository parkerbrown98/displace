import { notFound } from "next/navigation";
import { PublicResourceError } from "./public-data";

export function handlePublicResourceError(error: unknown): never {
  if (error instanceof PublicResourceError && error.reason !== "unavailable") {
    notFound();
  }
  throw error;
}