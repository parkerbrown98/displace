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
import { archiveVoiceRoom, createVoiceRoom, listVoiceRooms, updateVoiceRoom } from "./voice-client";
import type { CreateVoiceRoomInput, VoiceRoomContract, VoiceRoomInput } from "./voice-contracts";

export function VoiceRoomSettings({ context, onForbidden }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void> }) {
  const [rooms, setRooms] = useState<VoiceRoomContract[]>();
  const [loadError, setLoadError] = useState<string>();
  const [pending, setPending] = useState<string>();

  async function refresh() { setRooms(await listVoiceRooms(context.place.id)); }

  useEffect(() => {
    let active = true;
    void listVoiceRooms(context.place.id)
      .then((value) => { if (active) setRooms(value); })
      .catch((error) => { if (active) setLoadError(placeErrorMessage(error, "Voice rooms could not be loaded.")); });
    return () => { active = false; };
  }, [context.place.id]);

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setPending(key);
    try { await action(); await refresh(); toast.success(success); return true; }
    catch (error) { await onForbidden(error); toast.error(placeErrorMessage(error, "Voice rooms could not be changed.")); return false; }
    finally { setPending(undefined); }
  }

  return <section className="settings-section" id="voice">
    <header className="settings-section-title-row"><div><p className="eyebrow">Live audio</p><h2>Voice rooms</h2><p className="settings-muted">Drag rooms into member-facing order. Open one to tune capacity and speaking access.</p></div>{rooms ? <NewVoiceRoom disabled={Boolean(pending)} nextPosition={rooms.length} onCreate={(input) => run("create", () => createVoiceRoom(context.place.id, input), "Voice room created.")} /> : null}</header>
    {loadError ? <p className="form-message form-message-error" role="alert">{loadError}</p> : <>{rooms?.length ? <SortableList disabled={Boolean(pending)} items={rooms} label="Voice room order" onReorder={async (orderedRooms) => { await run("reorder-rooms", () => Promise.all(orderedRooms.map((room, position) => room.position === position ? Promise.resolve() : updateVoiceRoom(context.place.id, room.id, { position }))), "Voice rooms reordered."); }} renderItem={(room, handle) => <div className="settings-order-row">{handle}<VoiceRoomEditor disabled={Boolean(pending)} room={room} onArchive={() => run(`archive-${room.id}`, () => archiveVoiceRoom(context.place.id, room.id), "Voice room archived.")} onSave={(input) => run(`save-${room.id}`, () => updateVoiceRoom(context.place.id, room.id, input), "Voice room saved.")} /></div>} /> : <p className="settings-muted settings-empty-note">No voice rooms yet.</p>}</>}
  </section>;
}

function VoiceRoomEditor({ disabled, onArchive, onSave, room }: { disabled: boolean; onArchive: () => Promise<boolean>; onSave: (input: VoiceRoomInput) => Promise<boolean>; room: VoiceRoomContract }) {
  return <details className="role-editor"><summary><span><strong>{room.name}</strong></span><small>{room.participants.length}/{room.capacity} connected</small></summary><form className="settings-form" onSubmit={(event) => { event.preventDefault(); void onSave(roomInput(new FormData(event.currentTarget))); }}><VoiceFields room={room} /><div className="button-row"><button className="secondary-button" disabled={disabled} type="submit"><Save size={16} /> Save room</button><button className="danger-button" disabled={disabled} onClick={() => { if (window.confirm(`Archive ${room.name}? Connected members will not receive another join token.`)) void onArchive(); }} type="button"><Archive size={16} /> Archive</button></div></form></details>;
}

function NewVoiceRoom({ disabled, nextPosition, onCreate }: { disabled: boolean; nextPosition: number; onCreate: (input: CreateVoiceRoomInput) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (await onCreate({ ...roomInput(data), position: nextPosition, slug: String(data.get("slug") ?? "") })) { form.reset(); setOpen(false); }
  }
  return <SettingsDialog description="Set the room capacity and decide who can listen or speak." onOpenChange={setOpen} open={open} title="New voice room" trigger={<button className="primary-button" disabled={disabled} type="button"><Plus size={16} /> New room</button>}><form className="settings-form settings-dialog-form" onSubmit={submit}><FormField defaultValue="lounge" hint="Lowercase letters, numbers, and hyphens." label="Room slug" maxLength={80} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><VoiceFields /><button className="primary-button" disabled={disabled} type="submit"><Plus size={16} /> Create room</button></form></SettingsDialog>;
}

function VoiceFields({ room }: { room?: VoiceRoomContract }) {
  return <><FormField defaultValue={room?.name ?? "Lounge"} label="Name" maxLength={120} name="name" required />{room ? <input name="position" type="hidden" value={room.position} /> : null}<FormField defaultValue={room?.capacity ?? 25} label="Capacity" max={500} min={1} name="capacity" type="number" required /><PermissionSelect defaultValue={room?.listenPermission ?? "voice.join"} label="Listen permission" name="listenPermission" /><PermissionSelect defaultValue={room?.speakPermission ?? "voice.join"} label="Speak permission" name="speakPermission" /></>;
}

function PermissionSelect({ defaultValue, label, name }: { defaultValue: PlacePermission; label: string; name: string }) {
  return <label className="form-field">{label}<Select defaultValue={defaultValue} name={name} options={placePermissions.map((permission) => ({ label: permission.replace(".", " "), value: permission }))} /></label>;
}

function roomInput(form: FormData): VoiceRoomInput {
  return { capacity: Number(form.get("capacity") ?? 25), listenPermission: permission(form, "listenPermission"), name: String(form.get("name") ?? ""), position: Number(form.get("position") ?? 0), speakPermission: permission(form, "speakPermission") };
}

function permission(form: FormData, field: string): PlacePermission {
  const value = String(form.get(field) ?? "voice.join") as PlacePermission;
  return placePermissions.includes(value) ? value : "voice.join";
}