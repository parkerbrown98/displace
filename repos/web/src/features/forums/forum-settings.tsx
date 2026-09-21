"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import type { PlaceContextContract } from "@/features/places/place-contract";
import { placePermissions } from "@/features/places/place-contract";
import { placeErrorMessage } from "@/features/places/place-access";
import type { ForumContract, ForumGroupContract, ForumNavigationContract } from "@/features/public-content/public-contracts";
import {
  createForum,
  createForumGroup,
  createForumTag,
  deleteForum,
  deleteForumGroup,
  deleteForumTag,
  getForumNavigation,
  updateForum,
  updateForumGroup,
  type ForumInput,
} from "./forum-client";

type Notice = { kind: "error" | "success"; text: string } | null;

export function ForumSettings({
  context,
  onForbidden,
}: {
  context: PlaceContextContract;
  onForbidden: (error: unknown) => Promise<void>;
}) {
  const [navigation, setNavigation] = useState<ForumNavigationContract>();
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingAction, setPendingAction] = useState<string>();

  async function refresh() {
    setNavigation(await getForumNavigation(context.place.id));
  }

  useEffect(() => {
    let active = true;
    void getForumNavigation(context.place.id)
      .then((value) => { if (active) setNavigation(value); })
      .catch((error) => { if (active) setNotice({ kind: "error", text: placeErrorMessage(error, "Forum settings could not be loaded.") }); });
    return () => { active = false; };
  }, [context.place.id]);

  async function run(actionKey: string, action: () => Promise<unknown>, success: string): Promise<boolean> {
    setPendingAction(actionKey);
    setNotice(null);
    try {
      await action();
      await refresh();
      setNotice({ kind: "success", text: success });
      return true;
    } catch (error) {
      await onForbidden(error);
      setNotice({ kind: "error", text: placeErrorMessage(error, "Forum settings could not be changed.") });
      return false;
    } finally {
      setPendingAction(undefined);
    }
  }

  if (!navigation && !notice) return <section className="settings-section" id="forums"><p className="settings-muted">Loading forums...</p></section>;

  return (
    <section className="settings-section" id="forums">
      <p className="eyebrow">Discussion structure</p>
      <h2>Forums and tags</h2>
      <p className="settings-muted">Organize forums into ordered groups and define the tags members can apply to topics.</p>
      <NoticeMessage notice={notice} />

      {navigation ? <>
        <div className="forum-admin-list">
          {navigation.groups.map((group) => (
            <ForumGroupEditor
              disabled={Boolean(pendingAction)}
              group={group}
              groups={navigation.groups}
              key={group.id}
              onDelete={() => run(`delete-group-${group.id}`, () => deleteForumGroup(context.place.id, group.id), "Forum group deleted.")}
              onSave={(input) => run(`group-${group.id}`, () => updateForumGroup(context.place.id, group.id, input), "Forum group saved.")}
              placeId={context.place.id}
              run={run}
            />
          ))}
        </div>
        <NewForumGroupForm disabled={Boolean(pendingAction)} onCreate={(input) => run("new-group", () => createForumGroup(context.place.id, input), "Forum group created.")} />
        <NewForumForm disabled={Boolean(pendingAction)} groups={navigation.groups} onCreate={(input) => run("new-forum", () => createForum(context.place.id, input), "Forum created.")} />
        <div className="forum-tag-admin">
          <h3>Topic tags</h3>
          {navigation.tags.length ? <ul className="forum-tag-list">{navigation.tags.map((tag) => <li key={tag.id}>
            <span className="category-tag" style={tag.color ? { borderColor: tag.color } : undefined}>{tag.name}</span>
            <button aria-label={`Delete ${tag.name} tag`} className="icon-button" disabled={Boolean(pendingAction)} onClick={() => void run(`delete-tag-${tag.id}`, () => deleteForumTag(context.place.id, tag.id), "Tag deleted.")} title="Delete tag" type="button"><Trash2 size={16} /></button>
          </li>)}</ul> : <p className="settings-muted">No topic tags have been created.</p>}
          <NewForumTagForm disabled={Boolean(pendingAction)} onCreate={(input) => run("new-tag", () => createForumTag(context.place.id, input), "Tag created.")} />
        </div>
      </> : null}
    </section>
  );
}

function ForumGroupEditor({
  disabled,
  group,
  groups,
  onDelete,
  onSave,
  placeId,
  run,
}: {
  disabled: boolean;
  group: ForumGroupContract;
  groups: ForumGroupContract[];
  onDelete: () => Promise<boolean>;
  onSave: (input: { name: string; description: string; position: number }) => Promise<boolean>;
  placeId: string;
  run: (actionKey: string, action: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void onSave(groupInput(form));
  }

  return <details className="forum-admin-group">
    <summary><span><strong>{group.name}</strong><small>{group.forums.length} {group.forums.length === 1 ? "forum" : "forums"}</small></span></summary>
    <form className="settings-form forum-admin-form" onSubmit={submit}>
      <FormField defaultValue={group.name} label="Group name" maxLength={120} name="name" required />
      <label className="form-field">Description<textarea defaultValue={group.description} maxLength={2000} name="description" rows={3} /></label>
      <FormField defaultValue={group.position} label="Position" min={0} name="position" type="number" required />
      <div className="button-row"><button className="secondary-button" disabled={disabled} type="submit"><Save size={16} /> Save group</button><button className="danger-button" disabled={disabled} onClick={() => { if (window.confirm(`Delete ${group.name}? Empty groups are removed immediately.`)) void onDelete(); }} type="button"><Trash2 size={16} /> Delete group</button></div>
    </form>
    {group.forums.length ? <div className="forum-admin-forums">{group.forums.map((forum) => <ForumEditor disabled={disabled} forum={forum} groups={groups} key={forum.id} onDelete={() => run(`delete-forum-${forum.id}`, () => deleteForum(placeId, forum.id), "Forum archived.")} onSave={(input) => run(`forum-${forum.id}`, () => updateForum(placeId, forum.id, input), "Forum saved.")} />)}</div> : <p className="settings-muted forum-admin-empty">This group has no forums.</p>}
  </details>;
}

function ForumEditor({ disabled, forum, groups, onDelete, onSave }: { disabled: boolean; forum: ForumContract; groups: ForumGroupContract[]; onDelete: () => Promise<boolean>; onSave: (input: ForumInput) => Promise<boolean> }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(forumInput(new FormData(event.currentTarget)));
  }
  return <details className="forum-admin-forum"><summary><span><strong>{forum.name}</strong><small>{forum.visibility}</small></span></summary><form className="settings-form forum-admin-form" onSubmit={submit}>
    <ForumFields forum={forum} groups={groups} />
    <div className="button-row"><button className="secondary-button" disabled={disabled} type="submit"><Save size={16} /> Save forum</button><button className="danger-button" disabled={disabled} onClick={() => { if (window.confirm(`Archive ${forum.name}?`)) void onDelete(); }} type="button"><Trash2 size={16} /> Archive forum</button></div>
  </form></details>;
}

function NewForumGroupForm({ disabled, onCreate }: { disabled: boolean; onCreate: (input: { name: string; description: string; position: number }) => Promise<boolean> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await onCreate(groupInput(new FormData(form)))) form.reset();
  }
  return <details className="forum-admin-create"><summary><Plus size={16} /> <strong>Create forum group</strong></summary><form className="settings-form forum-admin-form" onSubmit={submit}><FormField label="Group name" maxLength={120} name="name" required /><label className="form-field">Description<textarea maxLength={2000} name="description" rows={3} /></label><FormField defaultValue={0} label="Position" min={0} name="position" type="number" required /><button className="primary-button" disabled={disabled} type="submit"><Plus size={16} /> Create group</button></form></details>;
}

function NewForumForm({ disabled, groups, onCreate }: { disabled: boolean; groups: ForumGroupContract[]; onCreate: (input: ForumInput) => Promise<boolean> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await onCreate(forumInput(new FormData(form)))) form.reset();
  }
  return <details className="forum-admin-create"><summary><Plus size={16} /> <strong>Create forum</strong></summary>{groups.length ? <form className="settings-form forum-admin-form" onSubmit={submit}><ForumFields groups={groups} /><button className="primary-button" disabled={disabled} type="submit"><Plus size={16} /> Create forum</button></form> : <p className="settings-muted forum-admin-empty">Create a forum group first.</p>}</details>;
}

function ForumFields({ forum, groups }: { forum?: ForumContract; groups: ForumGroupContract[] }) {
  return <>
    <label className="form-field">Group<select defaultValue={forum?.groupId} name="groupId" required>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    <FormField defaultValue={forum?.name} label="Forum name" maxLength={120} name="name" required />
    <label className="form-field">Description<textarea defaultValue={forum?.description} maxLength={2000} name="description" rows={3} /></label>
    <FormField defaultValue={forum?.position ?? 0} label="Position" min={0} name="position" type="number" required />
    <label className="form-field">Visibility<select defaultValue={forum?.visibility ?? "public"} name="visibility"><option value="public">Public</option><option value="members">Members only</option></select></label>
    <PermissionSelect defaultValue={forum?.readPermission} label="Read permission" name="readPermission" />
    <PermissionSelect defaultValue={forum?.writePermission} label="Write permission" name="writePermission" />
  </>;
}

function PermissionSelect({ defaultValue, label, name }: { defaultValue?: string | null; label: string; name: string }) {
  return <label className="form-field">{label}<select defaultValue={defaultValue ?? ""} name={name}><option value="">No additional permission</option>{placePermissions.map((permission) => <option key={permission} value={permission}>{permission.replace(".", " ")}</option>)}</select></label>;
}

function NewForumTagForm({ disabled, onCreate }: { disabled: boolean; onCreate: (input: { slug: string; name: string; color: string }) => Promise<boolean> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await onCreate({ color: String(data.get("color")), name: String(data.get("name")), slug: String(data.get("slug")) })) form.reset();
  }
  return <form className="settings-form forum-tag-form" onSubmit={submit}><FormField label="Tag name" maxLength={50} name="name" required /><FormField label="Tag slug" maxLength={50} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><label className="form-field">Color<input defaultValue="#2563eb" name="color" type="color" /></label><button className="primary-button" disabled={disabled} type="submit"><Plus size={16} /> Create tag</button></form>;
}

function groupInput(form: FormData) {
  return { description: String(form.get("description") ?? ""), name: String(form.get("name") ?? ""), position: Number(form.get("position") ?? 0) };
}

function forumInput(form: FormData): ForumInput {
  const readPermission = String(form.get("readPermission") ?? "");
  const writePermission = String(form.get("writePermission") ?? "");
  return {
    description: String(form.get("description") ?? ""),
    groupId: String(form.get("groupId") ?? ""),
    name: String(form.get("name") ?? ""),
    position: Number(form.get("position") ?? 0),
    readPermission: readPermission || null,
    visibility: String(form.get("visibility") ?? "public") as ForumInput["visibility"],
    writePermission: writePermission || null,
  };
}

function NoticeMessage({ notice }: { notice: Notice }) {
  return notice ? <p className={`form-message form-message-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null;
}
