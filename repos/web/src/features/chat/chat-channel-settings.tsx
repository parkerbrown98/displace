"use client";

import { Archive, Plus, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { SettingsDialog } from "@/components/ui/settings-dialog";
import { SortableList } from "@/components/ui/sortable-list";
import { toast } from "@/components/ui/toast";
import { placeErrorMessage } from "@/features/places/place-access";
import { placePermissions, type PlaceContextContract, type PlacePermission } from "@/features/places/place-contract";
import { archiveChatChannel, createChatChannel, listChatChannels, updateChatChannel } from "./chat-client";
import type { ChatChannelContract, CreateChatChannelInput, UpdateChatChannelInput } from "./chat-contracts";

export function ChatChannelSettings({
  context,
  onForbidden,
}: {
  context: PlaceContextContract;
  onForbidden: (error: unknown) => Promise<void>;
}) {
  const [channels, setChannels] = useState<ChatChannelContract[]>();
  const [loadError, setLoadError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>();

  async function refresh() {
    setChannels(await listChatChannels(context.place.id));
  }

  useEffect(() => {
    let active = true;
    void listChatChannels(context.place.id)
      .then((value) => { if (active) setChannels(value); })
      .catch((error) => { if (active) setLoadError(placeErrorMessage(error, "Chat channels could not be loaded.")); });
    return () => { active = false; };
  }, [context.place.id]);

  async function run(actionKey: string, action: () => Promise<unknown>, success: string): Promise<boolean> {
    setPendingAction(actionKey);
    try {
      await action();
      await refresh();
      toast.success(success);
      return true;
    } catch (error) {
      await onForbidden(error);
      toast.error(placeErrorMessage(error, "Chat channels could not be changed."));
      return false;
    } finally {
      setPendingAction(undefined);
    }
  }

  if (!channels && !loadError) return <section className="settings-section" id="chat"><p className="settings-muted">Loading chat channels...</p></section>;

  return (
    <section className="settings-section" id="chat">
      <header className="settings-section-title-row"><div><p className="eyebrow">Live conversation</p><h2>Chat channels</h2><p className="settings-muted">Drag channels into the order members should see. Open one to adjust access or archive it.</p></div>{channels ? <NewChatChannelForm disabled={Boolean(pendingAction)} nextPosition={channels.length} onCreate={(input) => run("new-channel", () => createChatChannel(context.place.id, input), "Channel created.")} /> : null}</header>
      {loadError ? <p className="form-message form-message-error" role="alert">{loadError}</p> : <>{channels?.length ? <SortableList disabled={Boolean(pendingAction)} items={channels} label="Chat channel order" onReorder={async (orderedChannels) => { await run("reorder-channels", () => Promise.all(orderedChannels.map((channel, position) => channel.position === position ? Promise.resolve() : updateChatChannel(context.place.id, channel.id, { position }))), "Channels reordered."); }} renderItem={(channel, handle) => <div className="settings-order-row">{handle}<ChatChannelEditor channel={channel} disabled={Boolean(pendingAction)} onArchive={() => run(`archive-${channel.id}`, () => archiveChatChannel(context.place.id, channel.id), "Channel archived.")} onSave={(input) => run(`channel-${channel.id}`, () => updateChatChannel(context.place.id, channel.id, input), "Channel saved.")} /></div>} /> : <p className="settings-muted settings-empty-note">No chat channels yet. Create a General channel to make Chat available to members.</p>}</>}
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

  return <details className="role-editor"><summary><span><strong>#{channel.name}</strong></span><small>{channel.visibility}</small></summary><form className="settings-form" onSubmit={submit}><ChannelFields channel={channel} /><div className="button-row"><button className="secondary-button" disabled={disabled} type="submit"><Save size={16} /> Save channel</button><button className="danger-button" disabled={disabled} onClick={() => { if (window.confirm(`Archive ${channel.name}? Existing messages will remain available to administrators.`)) void onArchive(); }} type="button"><Archive size={16} /> Archive</button></div></form></details>;
}

function NewChatChannelForm({ disabled, nextPosition, onCreate }: { disabled: boolean; nextPosition: number; onCreate: (input: CreateChatChannelInput) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await onCreate(channelCreateInput(new FormData(form), nextPosition))) { form.reset(); setOpen(false); }
  }

  return <SettingsDialog description="Set a recognizable name and choose who can read and post." onOpenChange={setOpen} open={open} title="New chat channel" trigger={<button className="primary-button" disabled={disabled} type="button"><Plus size={16} /> New channel</button>}><form className="settings-form settings-dialog-form" onSubmit={submit}><FormField defaultValue="General" label="Channel name" maxLength={120} name="name" required /><FormField defaultValue="general" hint="Lowercase letters, numbers, and hyphens." label="Channel slug" maxLength={80} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><ChannelFields /><button className="primary-button" disabled={disabled} type="submit"><Plus size={16} /> Create channel</button></form></SettingsDialog>;
}

function ChannelFields({ channel }: { channel?: ChatChannelContract }) {
  return <>{channel ? <input name="position" type="hidden" value={channel.position} /> : null}<label className="form-field">Visibility<Select defaultValue={channel?.visibility ?? "members"} name="visibility" options={[{ label: "Members only", value: "members" }, { label: "Public", value: "public" }]} /></label><PermissionSelect defaultValue={channel?.readPermission} label="Read permission" name="readPermission" /><PermissionSelect defaultValue={channel?.sendPermission} label="Send permission" name="sendPermission" /></>;
}

function PermissionSelect({ defaultValue, label, name }: { defaultValue?: string | null; label: string; name: string }) {
  return <label className="form-field">{label}<Select defaultValue={defaultValue ?? ""} name={name} options={[{ label: "No additional permission", value: "" }, ...placePermissions.map((permission) => ({ label: permission.replace(".", " "), value: permission }))]} /></label>;
}

function channelCreateInput(form: FormData, position: number): CreateChatChannelInput {
  const readPermission = permissionFrom(form, "readPermission");
  const sendPermission = permissionFrom(form, "sendPermission");
  return {
    name: String(form.get("name") ?? ""),
    position,
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
