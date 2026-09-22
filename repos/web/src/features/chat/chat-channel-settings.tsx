"use client";

import { Archive, Plus, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { placeErrorMessage } from "@/features/places/place-access";
import { placePermissions, type PlaceContextContract, type PlacePermission } from "@/features/places/place-contract";
import { archiveChatChannel, createChatChannel, listChatChannels, updateChatChannel } from "./chat-client";
import type { ChatChannelContract, CreateChatChannelInput, UpdateChatChannelInput } from "./chat-contracts";

type Notice = { kind: "error" | "success"; text: string } | null;

export function ChatChannelSettings({
  context,
  onForbidden,
}: {
  context: PlaceContextContract;
  onForbidden: (error: unknown) => Promise<void>;
}) {
  const [channels, setChannels] = useState<ChatChannelContract[]>();
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingAction, setPendingAction] = useState<string>();

  async function refresh() {
    setChannels(await listChatChannels(context.place.id));
  }

  useEffect(() => {
    let active = true;
    void listChatChannels(context.place.id)
      .then((value) => { if (active) setChannels(value); })
      .catch((error) => { if (active) setNotice({ kind: "error", text: placeErrorMessage(error, "Chat channels could not be loaded.") }); });
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
      setNotice({ kind: "error", text: placeErrorMessage(error, "Chat channels could not be changed.") });
      return false;
    } finally {
      setPendingAction(undefined);
    }
  }

  if (!channels && !notice) return <section className="settings-section" id="chat"><p className="settings-muted">Loading chat channels...</p></section>;

  return (
    <section className="settings-section" id="chat">
      <p className="eyebrow">Live conversation</p>
      <h2>Chat channels</h2>
      <p className="settings-muted">Create the spaces members use for real-time conversation and control who can read or post in each one.</p>
      <NoticeMessage notice={notice} />
      {channels?.length ? <div className="role-list">{channels.map((channel) => <ChatChannelEditor channel={channel} disabled={Boolean(pendingAction)} key={channel.id} onArchive={() => run(`archive-${channel.id}`, () => archiveChatChannel(context.place.id, channel.id), "Channel archived.")} onSave={(input) => run(`channel-${channel.id}`, () => updateChatChannel(context.place.id, channel.id, input), "Channel saved.")} />)}</div> : <p className="settings-muted">No chat channels yet. Create a General channel to make Chat available to members.</p>}
      <NewChatChannelForm disabled={Boolean(pendingAction)} onCreate={(input) => run("new-channel", () => createChatChannel(context.place.id, input), "Channel created.")} />
    </section>
  );
}

function ChatChannelEditor({
  channel,
  disabled,
  onArchive,
  onSave,
}: {
  channel: ChatChannelContract;
  disabled: boolean;
  onArchive: () => Promise<boolean>;
  onSave: (input: UpdateChatChannelInput) => Promise<boolean>;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(channelUpdateInput(new FormData(event.currentTarget)));
  }

  return <details className="role-editor"><summary><span><strong>#{channel.name}</strong></span><small>{channel.visibility} · position {channel.position}</small></summary><form className="settings-form" onSubmit={submit}><ChannelFields channel={channel} /><div className="button-row"><button className="secondary-button" disabled={disabled} type="submit"><Save size={16} /> Save channel</button><button className="danger-button" disabled={disabled} onClick={() => { if (window.confirm(`Archive ${channel.name}? Existing messages will remain available to administrators.`)) void onArchive(); }} type="button"><Archive size={16} /> Archive</button></div></form></details>;
}

function NewChatChannelForm({ disabled, onCreate }: { disabled: boolean; onCreate: (input: CreateChatChannelInput) => Promise<boolean> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await onCreate(channelCreateInput(new FormData(form)))) form.reset();
  }

  return <details className="role-editor new-role" open><summary><span><Plus size={16} /> <strong>Create channel</strong></span></summary><form className="settings-form" onSubmit={submit}><FormField defaultValue="General" label="Channel name" maxLength={120} name="name" required /><FormField defaultValue="general" hint="Lowercase letters, numbers, and hyphens." label="Channel slug" maxLength={80} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><ChannelFields /><button className="primary-button" disabled={disabled} type="submit"><Plus size={16} /> Create channel</button></form></details>;
}

function ChannelFields({ channel }: { channel?: ChatChannelContract }) {
  return <><FormField defaultValue={channel?.position ?? 0} label="Position" min={0} name="position" type="number" required /><label className="form-field">Visibility<select defaultValue={channel?.visibility ?? "members"} name="visibility"><option value="members">Members only</option><option value="public">Public</option></select></label><PermissionSelect defaultValue={channel?.readPermission} label="Read permission" name="readPermission" /><PermissionSelect defaultValue={channel?.sendPermission} label="Send permission" name="sendPermission" /></>;
}

function PermissionSelect({ defaultValue, label, name }: { defaultValue?: string | null; label: string; name: string }) {
  return <label className="form-field">{label}<select defaultValue={defaultValue ?? ""} name={name}><option value="">No additional permission</option>{placePermissions.map((permission) => <option key={permission} value={permission}>{permission.replace(".", " ")}</option>)}</select></label>;
}

function channelCreateInput(form: FormData): CreateChatChannelInput {
  const readPermission = permissionFrom(form, "readPermission");
  const sendPermission = permissionFrom(form, "sendPermission");
  return {
    name: String(form.get("name") ?? ""),
    position: Number(form.get("position") ?? 0),
    ...(readPermission ? { readPermission } : {}),
    ...(sendPermission ? { sendPermission } : {}),
    slug: String(form.get("slug") ?? ""),
    visibility: String(form.get("visibility") ?? "members") as CreateChatChannelInput["visibility"],
  };
}

function channelUpdateInput(form: FormData): UpdateChatChannelInput {
  return {
    position: Number(form.get("position") ?? 0),
    readPermission: permissionFrom(form, "readPermission"),
    sendPermission: permissionFrom(form, "sendPermission"),
    visibility: String(form.get("visibility") ?? "members") as UpdateChatChannelInput["visibility"],
  };
}

function permissionFrom(form: FormData, field: string): PlacePermission | null {
  const value = String(form.get(field) ?? "");
  return placePermissions.includes(value as PlacePermission) ? value as PlacePermission : null;
}

function NoticeMessage({ notice }: { notice: Notice }) {
  return notice ? <p className={`form-message form-message-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null;
}