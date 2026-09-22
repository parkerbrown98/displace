import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PlacesModule } from '../places/places.module.js';
import { PresenceService } from './presence.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimePublisherModule } from './realtime-publisher.module.js';
import { VoiceModule } from '../voice/voice.module.js';

@Module({
  imports: [AuthModule, ChatModule, NotificationsModule, PlacesModule, RealtimePublisherModule, VoiceModule],
  providers: [PresenceService, RealtimeGateway],
})
export class RealtimeModule {}