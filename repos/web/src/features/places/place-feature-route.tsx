"use client";

import Link from "next/link";
import { routes } from "@/lib/routes";
import { PlaceWorkspaceGate } from "./place-access";
import { PlaceForumHeader } from "./place-forum-header";

export function PlaceFeatureRoute({
  description,
  eyebrow,
  placeId,
  sectionHref,
  sectionLabel,
  title,
}: {
  description: string;
  eyebrow: string;
  placeId: string;
  sectionHref: string;
  sectionLabel: string;
  title: string;
}) {
  return (
    <PlaceWorkspaceGate placeId={placeId} returnTo={sectionHref}>
      {({ context }) => (
        <main className="public-main place-workspace-page" id="main-content">
          <PlaceForumHeader
            active="chat"
            currentSection={{ href: sectionHref, label: sectionLabel }}
            place={context.place}
          />
          <nav className="breadcrumbs place-page-breadcrumbs" aria-label="Breadcrumb">
            <Link href={routes.place(context.place.slug)}>Forums</Link><span aria-hidden="true">/</span><span>{sectionLabel}</span>
          </nav>
          <section className="place-feature-panel">
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </section>
        </main>
      )}
    </PlaceWorkspaceGate>
  );
}
