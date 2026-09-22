import type { Clock } from '../platform/clock/clock.js';
import type { PlacesRepository } from '../places/places.repository.js';
import type { RealtimePublisher } from '../realtime/realtime.publisher.js';
import type { VoiceLiveKitService, VoiceParticipant } from './voice-livekit.service.js';
import type { VoiceRepository } from './voice.repository.js';
import { VoiceService } from './voice.service.js';

describe('VoiceService', () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  const room = {
    archivedAt: null,
    capacity: 2,
    createdAt: now,
    id: '01997a4e-a200-7000-8000-000000000003',
    listenPermission: 'voice.join',
    name: 'Lounge',
    placeId: '01997a4e-a200-7000-8000-000000000002',
    position: 0,
    slug: 'lounge',
    speakPermission: 'voice.manage',
    updatedAt: now,
  };
  const participant: VoiceParticipant = {
    canPublish: true,
    displayName: 'Speaker',
    identity: '01997a4e-a200-7000-8000-000000000004',
    joinedAt: now.toISOString(),
    microphoneMuted: false,
  };
  const listRooms = vi.fn().mockResolvedValue([room]);
  const findRoom = vi.fn().mockResolvedValue(room);
  const repository = { findRoom, listRooms } as unknown as VoiceRepository;
  const getAuthorization = vi.fn();
  const findMemberByUserId = vi.fn().mockResolvedValue({
    displayName: 'Listener',
    status: 'active',
  });
  const places = {
    findMemberByUserId,
    getAuthorization,
  } as unknown as PlacesRepository;
  const listParticipants = vi.fn().mockResolvedValue([participant]);
  const ensureRoom = vi.fn().mockResolvedValue(`voice:${room.placeId}:${room.id}`);
  const createJoinToken = vi.fn().mockResolvedValue('join-token');
  const removeParticipant = vi.fn();
  const updateParticipantPermissions = vi.fn();
  const livekit = {
    createJoinToken,
    ensureRoom,
    listParticipants,
    removeParticipant,
    serverUrl: 'ws://localhost:7880',
    updateParticipantPermissions,
  } as unknown as VoiceLiveKitService;
  const realtime = {
    publishVoiceRoomUpdated: vi.fn(),
  } as unknown as RealtimePublisher;
  const clock: Clock = { now: () => now };

  beforeEach(() => {
    vi.clearAllMocks();
    listRooms.mockResolvedValue([room]);
    findRoom.mockResolvedValue(room);
    listParticipants.mockResolvedValue([participant]);
    findMemberByUserId.mockResolvedValue({ displayName: 'Listener', status: 'active' });
  });

  it('returns participant summaries only for rooms the member can listen to', async () => {
    getAuthorization.mockResolvedValue({ permissions: new Set(['voice.join']) });
    const service = new VoiceService(repository, livekit, places, realtime, clock);

    await expect(service.listRooms(room.placeId, 'user-id')).resolves.toEqual([
      expect.objectContaining({
        canJoin: true,
        canSpeak: false,
        participants: [participant],
      }),
    ]);
  });

  it('issues a listen-only token when the speak permission is absent', async () => {
    getAuthorization.mockResolvedValue({ permissions: new Set(['voice.join']) });
    const service = new VoiceService(repository, livekit, places, realtime, clock);

    await expect(service.createJoinToken(room.placeId, room.id, 'user-id')).resolves.toMatchObject({
      canPublish: false,
      expiresAt: new Date('2026-09-22T12:10:00.000Z'),
      serverUrl: 'ws://localhost:7880',
      token: 'join-token',
    });
    expect(createJoinToken).toHaveBeenCalledWith(expect.objectContaining({ canPublish: false }));
  });

  it('rejects a new participant when the configured capacity is reached', async () => {
    getAuthorization.mockResolvedValue({ permissions: new Set(['voice.join']) });
    listParticipants.mockResolvedValue([
      participant,
      { ...participant, identity: 'another-user' },
    ]);
    const service = new VoiceService(repository, livekit, places, realtime, clock);

    await expect(service.createJoinToken(room.placeId, room.id, 'user-id')).rejects.toThrow('Voice room is full.');
    expect(createJoinToken).not.toHaveBeenCalled();
  });

  it('revokes active publishing when room speaking policy changes', async () => {
    getAuthorization
      .mockResolvedValueOnce({ permissions: new Set(['voice.manage']) })
      .mockResolvedValueOnce({ permissions: new Set(['voice.join']) })
      .mockResolvedValueOnce({ permissions: new Set(['voice.manage']) });
    const updateRoom = vi.fn().mockResolvedValue(room);
    const service = new VoiceService(
      { ...repository, updateRoom } as unknown as VoiceRepository,
      livekit,
      places,
      realtime,
      clock,
    );

    await service.updateRoom(room.placeId, room.id, 'manager-id', {
      speakPermission: 'voice.manage',
    });

    expect(updateParticipantPermissions).toHaveBeenCalledWith(
      room.placeId,
      room.id,
      participant.identity,
      false,
    );
  });
});