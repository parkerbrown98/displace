import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

export default function Home() {
  const configuredPlace = process.env.NEXT_PUBLIC_SINGLE_PLACE_SLUG;
  redirect(configuredPlace ? routes.place(configuredPlace) : routes.discover);
}
