"use client";

import { AudioLines, Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Radio, Settings2, Volume2 } from "lucide-react";
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { toast } from "@/components/ui/toast";
import { placeErrorMessage } from "@/features/places/place-access";
import type { PlaceContract } from "@/features/places/place-contract";
import { realtimeSocket } from "@/features/realtime/realtime-client";
import { createVoiceJoinToken, listVoiceRooms } from "./voice-client";
import type { VoiceParticipantContract, VoiceRoomContract } from "./voice-contracts";

type ConnectionState = "connected" | "connecting" | "disconnected" | "reconnecting";

export function PlaceVoicePanel({ place }: { place: PlaceContract }) {
  const [rooms, setRooms] = useState<VoiceRoomContract[]>();
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void listVoiceRooms(place.id).then((items) => { if (!active) return; setRooms(items); setSelectedId((current) => current ?? items.at(0)?.id); }).catch((cause) => { if (active) setError(placeErrorMessage(cause, "Voice rooms could not be loaded.")); });
    return () => { active = false; };
  }, [place.id]);

  useEffect(() => {
    const socket = realtimeSocket(); if (!socket) return;
    const join = () => socket.emit("place.join", { placeId: place.id });
    const refresh = () => {
      void listVoiceRooms(place.id).then((items) => {
        setRooms(items);
        setSelectedId((current) => items.some((room) => room.id === current) ? current : items.at(0)?.id);
      }).catch(() => undefined);
    };
    const updated = (event: { placeId: string }) => { if (event.placeId === place.id) refresh(); };
    socket.on("connect", join); socket.on("voice.room.updated", updated); if (socket.connected) join();
    return () => { socket.off("connect", join); socket.off("voice.room.updated", updated); };
  }, [place.id]);

  if (!rooms && !error) return <div className="live-voice-state"><LoadingPanel label="Loading voice rooms" /></div>;
  if (!rooms?.length) return <div className="live-voice-state"><StatusPanel description={error ?? "No voice rooms are available to your current roles."} title="Voice unavailable" /></div>;
  const selected = rooms.find((room) => room.id === selectedId) ?? rooms[0]!;

  return <aside className="live-audio-panel" aria-label="Audio rooms">
      <header className="live-audio-panel-heading"><span><AudioLines size={17} /></span><div><p className="eyebrow">Audio rooms</p><strong>On air</strong></div></header>
      <div className="voice-room-list">{rooms.map((room) => <button aria-pressed={room.id === selected.id} className="voice-room-button" key={room.id} onClick={() => setSelectedId(room.id)} type="button"><Radio size={14} /><span><strong>{room.name}</strong><small>{room.participants.length}/{room.capacity}</small></span></button>)}</div>
      <VoiceSession key={selected.id} onRoomsChanged={setRooms} placeId={place.id} room={selected} />
    </aside>;
}

function VoiceSession({ onRoomsChanged, placeId, room }: { onRoomsChanged: (rooms: VoiceRoomContract[]) => void; placeId: string; room: VoiceRoomContract }) {
  const liveRoom = useRef<Room | null>(null);
  const media = useRef<HTMLDivElement>(null);
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [participants, setParticipants] = useState(room.participants);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [publishAllowed, setPublishAllowed] = useState(room.canSpeak);
  const [deafened, setDeafened] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const socket = realtimeSocket();
    const watch = () => { setRealtimeConnected(false); socket?.emit("voice.watch", { placeId, roomId: room.id }); };
    const watched = (event: { roomId: string }) => {
      if (event.roomId !== room.id) return;
      setRealtimeConnected(true);
      void listVoiceRooms(placeId).then(onRoomsChanged).catch(() => setRealtimeConnected(false));
    };
    const disconnected = () => setRealtimeConnected(false);
    socket?.on("connect", watch);
    socket?.on("disconnect", disconnected);
    socket?.on("voice.watched", watched);
    if (socket?.connected) watch();
    return () => { socket?.off("connect", watch); socket?.off("disconnect", disconnected); socket?.off("voice.watched", watched); void liveRoom.current?.disconnect(); liveRoom.current = null; };
  }, [onRoomsChanged, placeId, room.id]);

  useEffect(() => {
    if (!liveRoom.current) setParticipants(room.participants);
  }, [room.participants]);

  useEffect(() => {
    if (room.canSpeak || !liveRoom.current) return;
    if (microphoneEnabled) void liveRoom.current.localParticipant.setMicrophoneEnabled(false).finally(() => setMicrophoneEnabled(false));
    toast.error("Your speaking permission changed. You can continue listening.");
  }, [microphoneEnabled, room.canSpeak]);

  async function join() {
    setConnection("connecting");
    try {
      const ticket = await createVoiceJoinToken(placeId, room.id);
      const next = new Room({ adaptiveStream: true, dynacast: true });
      const sync = () => setParticipants(participantsFrom(next));
      next.on(RoomEvent.ParticipantConnected, sync);
      next.on(RoomEvent.ParticipantDisconnected, sync);
      next.on(RoomEvent.TrackMuted, sync);
      next.on(RoomEvent.TrackUnmuted, sync);
      next.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => { if (track.kind === Track.Kind.Audio && media.current) media.current.append(track.attach()); sync(); });
      next.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => { track.detach().forEach((element) => element.remove()); sync(); });
      next.on(RoomEvent.Reconnecting, () => setConnection("reconnecting"));
      next.on(RoomEvent.Reconnected, () => setConnection("connected"));
      next.on(RoomEvent.Disconnected, () => { setConnection("disconnected"); setMicrophoneEnabled(false); });
      next.on(RoomEvent.MediaDevicesError, () => toast.error("A selected audio device is unavailable. Choose another device and try again."));
      next.on(RoomEvent.AudioPlaybackStatusChanged, (playing) => setPlaybackBlocked(!playing));
      next.on(RoomEvent.ParticipantPermissionsChanged, (_previous, participant) => {
        if (participant === next.localParticipant) {
          const canPublish = participant.permissions?.canPublish ?? false;
          setPublishAllowed(canPublish);
          if (!canPublish) {
            setMicrophoneEnabled(false);
            toast.error("Your speaking permission changed. You can continue listening.");
          }
        }
        sync();
      });
      await next.connect(ticket.serverUrl, ticket.token, {
        maxRetries: 1,
        peerConnectionTimeout: 10_000,
        websocketTimeout: 10_000,
      });
      liveRoom.current = next;
      setPublishAllowed(ticket.canPublish);
      setConnection("connected"); sync();
      if (ticket.canPublish) {
        try {
          await next.localParticipant.setMicrophoneEnabled(true);
          setMicrophoneEnabled(true);
        } catch {
          toast.error("Connected without a microphone. Allow microphone access or choose another input device.");
        }
      }
      try {
        setDevices(await navigator.mediaDevices?.enumerateDevices() ?? []);
      } catch {
        toast.error("Audio device selection is unavailable, but the room remains connected.");
      }
    } catch (cause) {
      await liveRoom.current?.disconnect(); liveRoom.current = null; setConnection("disconnected");
      toast.error(placeErrorMessage(cause, "The voice room could not connect. Check your network and try again."));
    }
  }

  async function leave() { await liveRoom.current?.disconnect(); liveRoom.current = null; setConnection("disconnected"); setParticipants(room.participants); setMicrophoneEnabled(false); }
  async function toggleMicrophone() {
    if (!liveRoom.current || !publishAllowed) return;
    const enabled = !microphoneEnabled;
    try { await liveRoom.current.localParticipant.setMicrophoneEnabled(enabled); setMicrophoneEnabled(enabled); }
    catch { toast.error("The microphone could not be changed. Check browser and device permissions."); }
  }
  function toggleDeafen() { const next = !deafened; media.current?.querySelectorAll("audio").forEach((audio) => { audio.muted = next; }); setDeafened(next); }
  async function switchDevice(kind: "audioinput" | "audiooutput", deviceId: string) {
    try { await liveRoom.current?.switchActiveDevice(kind, deviceId, true); }
    catch { toast.error("The selected audio device could not be activated."); }
  }
  async function resumeAudio() {
    try { await liveRoom.current?.startAudio(); setPlaybackBlocked(false); }
    catch { toast.error("Browser audio playback is blocked. Allow audio for this site and try again."); }
  }

  const joined = connection === "connected" || connection === "reconnecting";
  const speakingAllowed = room.canSpeak && publishAllowed;
  return <section className="voice-room" aria-label={room.name}>
    <header className="voice-heading"><div><p className="eyebrow">Listening room</p><h2>{room.name}</h2><p>{participants.length} of {room.capacity} connected · <span className="voice-live-status">{realtimeConnected ? "Live" : "Connecting"}</span></p></div><span className={`voice-connection voice-connection-${connection}`}>{connection}</span></header>
    <div className="voice-participants">{participants.length ? participants.map((participant) => <ParticipantTile key={participant.identity} participant={participant} />) : <div className="voice-empty"><Headphones size={28} /><strong>The room is quiet</strong><span>Join when you are ready to talk or listen.</span></div>}</div>
    {joined ? <details className="voice-device-panel"><summary><Settings2 size={15} /> Audio devices</summary><div><label>Microphone<Select aria-label="Microphone" onValueChange={(value) => void switchDevice("audioinput", value)} options={devices.filter((device) => device.kind === "audioinput").map((device) => ({ label: device.label || "Microphone", value: device.deviceId }))} /></label><label>Output<Select aria-label="Output" onValueChange={(value) => void switchDevice("audiooutput", value)} options={devices.filter((device) => device.kind === "audiooutput").map((device) => ({ label: device.label || "Speaker", value: device.deviceId }))} /></label></div></details> : null}
    <footer className="voice-controls">{joined ? <>{playbackBlocked ? <button className="secondary-button" onClick={() => void resumeAudio()} type="button"><Volume2 size={17} /> Enable audio</button> : null}<button aria-pressed={!microphoneEnabled} className="icon-button" disabled={!speakingAllowed} onClick={() => void toggleMicrophone()} title={speakingAllowed ? microphoneEnabled ? "Mute microphone" : "Unmute microphone" : "Speaking is not permitted"} type="button">{microphoneEnabled ? <Mic size={19} /> : <MicOff size={19} />}<span className="sr-only">{microphoneEnabled ? "Mute microphone" : "Unmute microphone"}</span></button><button aria-pressed={deafened} className="icon-button" onClick={toggleDeafen} title={deafened ? "Restore audio" : "Deafen"} type="button">{deafened ? <HeadphoneOff size={19} /> : <Headphones size={19} />}<span className="sr-only">{deafened ? "Restore audio" : "Deafen"}</span></button><button className="danger-button" onClick={() => void leave()} type="button"><PhoneOff size={17} /> Leave</button></> : <button className="primary-button" disabled={connection === "connecting" || !room.canJoin} onClick={() => void join()} type="button"><Headphones size={17} /> {connection === "connecting" ? "Joining..." : "Join room"}</button>}</footer>
    <div aria-hidden="true" className="voice-media" ref={media} />
  </section>;
}

function ParticipantTile({ participant }: { participant: VoiceParticipantContract }) {
  return <article className="voice-participant"><span className="voice-avatar" aria-hidden="true">{participant.displayName.slice(0, 2).toUpperCase()}</span><div><strong>{participant.displayName}</strong><small>{participant.canPublish ? participant.microphoneMuted ? "Muted" : "Speaking enabled" : "Listening"}</small></div>{participant.microphoneMuted || !participant.canPublish ? <MicOff aria-label="Muted" size={16} /> : <Mic aria-label="Microphone on" size={16} />}</article>;
}

function participantsFrom(room: Room): VoiceParticipantContract[] {
  return [room.localParticipant, ...room.remoteParticipants.values()].map((participant: Participant) => ({
    canPublish: participant.permissions?.canPublish ?? false,
    displayName: participant.name || participant.identity,
    identity: participant.identity,
    joinedAt: new Date().toISOString(),
    microphoneMuted: participant.getTrackPublication(Track.Source.Microphone)?.isMuted ?? true,
  }));
}