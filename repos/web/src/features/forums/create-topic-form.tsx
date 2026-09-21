"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { StatusPanel } from "@/components/ui/status-panel";
import { PlaceWorkspaceGate, placeErrorMessage } from "@/features/places/place-access";
import type { PlaceContract } from "@/features/places/place-contract";
import type { ForumNavigationContract } from "@/features/public-content/public-contracts";
import { routes } from "@/lib/routes";
import { createTopic } from "./forum-client";
import type { RichTextDocumentContract } from "./forum-contract";
import { ForumEditor } from "./forum-editor";

export function CreateTopicScreen({ navigation, place }: { navigation: ForumNavigationContract; place: PlaceContract }) {
  return (
    <PlaceWorkspaceGate placeId={place.id}>
      {({ context }) => context.viewer.permissions.includes("topic.create") ? (
        <CreateTopicForm navigation={navigation} place={place} />
      ) : (
        <main className="public-main" id="main-content"><StatusPanel description="Your role does not allow creating topics here." title="Topic creation unavailable" /></main>
      )}
    </PlaceWorkspaceGate>
  );
}

function CreateTopicForm({ navigation, place }: { navigation: ForumNavigationContract; place: PlaceContract }) {
  const router = useRouter();
  const forums = navigation.groups.flatMap((group) => group.forums);
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
