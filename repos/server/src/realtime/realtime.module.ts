import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PlacesModule } from '../places/places.module.js';
import { PresenceService } from './presence.service.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [AuthModule, ChatModule, NotificationsModule, PlacesModule],
  providers: [PresenceService, RealtimeGateway],
})
export class RealtimeModule {}