"use client";

import { Plus, Send, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { PlaceWorkspaceGate, placeErrorMessage, usePlaceWorkspace } from "@/features/places/place-access";
import type { PlaceContextContract, PlaceContract, PlacePermission } from "@/features/places/place-contract";
import type { ForumNavigationContract } from "@/features/public-content/public-contracts";
import { routes } from "@/lib/routes";
import { createTopic, getForumNavigation } from "./forum-client";
import type { RichTextDocumentContract } from "./forum-contract";
import { ForumEditor } from "./forum-editor";

export function CreateTopicScreen({ placeId }: { placeId: string }) {
  return (
    <PlaceWorkspaceGate placeId={placeId}>
      {({ context }) => context.viewer.permissions.includes("topic.create") ? (
        <CreateTopicLoader context={context} />
      ) : (
        <main className="public-main" id="main-content"><StatusPanel description="Your role does not allow creating topics here." title="Topic creation unavailable" /></main>
      )}
    </PlaceWorkspaceGate>
  );
}

function CreateTopicLoader({ context }: { context: PlaceContextContract }) {
  const [navigation, setNavigation] = useState<ForumNavigationContract>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void getForumNavigation(context.place.id).then((value) => {
      if (active) setNavigation(value);
    }).catch((cause) => {
      if (active) setError(placeErrorMessage(cause, "Forums could not be loaded."));
    });
    return () => { active = false; };
  }, [context.place.id]);

  if (error) return <main className="public-main" id="main-content"><StatusPanel description={error} title="Forums unavailable" tone="error" /></main>;
  if (!navigation) return <main className="public-main" id="main-content"><LoadingPanel label="Loading forums" /></main>;
  return <CreateTopicForm navigation={navigation} permissions={context.viewer.permissions} place={context.place} />;
}

export function ForumAuthoringActions({ placeId, placeSlug }: { placeId: string; placeSlug: string }) {
  const workspace = usePlaceWorkspace(placeId);
  const canCreateTopics = workspace.context?.viewer.permissions.includes("topic.create");
  const canManageForums = workspace.context?.viewer.permissions.includes("forum.manage");
  if (!canCreateTopics && !canManageForums) return null;
  return <div className="forum-authoring-actions">
    {canManageForums ? <Link className="secondary-button" href={`${routes.placeSettings(placeSlug)}#forums`}><Settings size={16} /> Manage forums</Link> : null}
    {canCreateTopics ? <Link className="primary-button" href={routes.createTopic(placeSlug)}><Plus size={16} /> New topic</Link> : null}
  </div>;
}

function CreateTopicForm({ navigation, permissions, place }: { navigation: ForumNavigationContract; permissions: PlacePermission[]; place: PlaceContract }) {
  const router = useRouter();
  const forums = navigation.groups.flatMap((group) => group.forums).filter((forum) => !forum.writePermission || permissions.includes(forum.writePermission as PlacePermission));
  const [document, setDocument] = useState<RichTextDocumentContract>();
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || editorEmpty) return;
    setPending(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const topic = await createTopic(place.id, String(data.get("forumId")), {
        document,
        tagIds: data.getAll("tagIds").map(String),
        title: String(data.get("title")),
      });
      router.push(routes.topic(place.slug, topic.id));
      router.refresh();
    } catch (cause) {
      setError(placeErrorMessage(cause, "The topic could not be created."));
      setPending(false);
    }
  }

  if (!forums.length) {
    return <main className="public-main" id="main-content"><StatusPanel description="A forum must be created before members can start discussions." title="No forums available" /></main>;
  }

  return (
    <main className="public-main topic-compose-page" id="main-content">
      <header className="public-page-heading compact-heading">
        <p className="eyebrow">{place.name} / Discussion</p>
        <h1>New topic</h1>
        <p>Start a durable conversation with enough context for others to contribute.</p>
      </header>
      <form className="topic-compose-form" onSubmit={submit}>
        <div className="topic-compose-fields">
          <label className="form-field">Forum<select name="forumId" required>{forums.map((forum) => <option key={forum.id} value={forum.id}>{forum.name}</option>)}</select></label>
          <label className="form-field">Title<input maxLength={300} minLength={1} name="title" required /></label>
        </div>
        {navigation.tags.length ? <fieldset className="topic-tag-picker"><legend>Tags</legend>{navigation.tags.map((tag) => <label key={tag.id}><input name="tagIds" type="checkbox" value={tag.id} /><span>{tag.name}</span></label>)}</fieldset> : null}
        <ForumEditor label="Opening post" onChange={(nextDocument, isEmpty) => { setDocument(nextDocument); setEditorEmpty(isEmpty); }} placeId={place.id} />
        {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
        <div className="topic-compose-actions"><button className="primary-button" disabled={pending || editorEmpty} type="submit"><Send size={16} />{pending ? "Publishing..." : "Publish topic"}</button></div>
      </form>
    </main>
  );
}
