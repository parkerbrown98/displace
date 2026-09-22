import { ConfigService } from '@nestjs/config';
import { TokenVerifier } from 'livekit-server-sdk';
import type { AppEnvironment } from '../config/environment.js';
import { VoiceLiveKitService } from './voice-livekit.service.js';

describe('VoiceLiveKitService', () => {
  const apiKey = 'voice-test-key';
  const apiSecret = 'voice-test-secret-at-least-32-bytes';
  const config = new ConfigService<AppEnvironment, true>({
    LIVEKIT_API_KEY: apiKey,
    LIVEKIT_API_SECRET: apiSecret,
    LIVEKIT_PUBLIC_URL: 'ws://localhost:7880',
    LIVEKIT_URL: 'http://livekit:7880',
  } as AppEnvironment);

  it('issues a short-lived room-scoped listen-only grant', async () => {
    const service = new VoiceLiveKitService(config);
    const token = await service.createJoinToken({
      canPublish: false,
      displayName: 'Listener',
      identity: '01997a4e-a200-7000-8000-000000000001',
      placeId: '01997a4e-a200-7000-8000-000000000002',
      roomId: '01997a4e-a200-7000-8000-000000000003',
    });
    const claims = await new TokenVerifier(apiKey, apiSecret).verify(token);

    expect(service.serverUrl).toBe('ws://localhost:7880');
    expect(claims.video).toMatchObject({
      canPublish: false,
      canPublishData: false,
      canSubscribe: true,
      room: service.roomName(
        '01997a4e-a200-7000-8000-000000000002',
        '01997a4e-a200-7000-8000-000000000003',
      ),
      roomJoin: true,
    });
  });

  it('only parses room names owned by the voice domain', () => {
    const service = new VoiceLiveKitService(config);
    expect(
      service.parseRoomName(
        'voice:01997a4e-a200-7000-8000-000000000002:01997a4e-a200-7000-8000-000000000003',
      ),
    ).toEqual({
      placeId: '01997a4e-a200-7000-8000-000000000002',
      roomId: '01997a4e-a200-7000-8000-000000000003',
    });
    expect(service.parseRoomName('unrelated-room')).toBeUndefined();
  });
});