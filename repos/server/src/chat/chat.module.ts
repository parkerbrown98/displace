import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlacesModule } from '../places/places.module.js';
import { ChatController } from './chat.controller.js';
import { ChatRepository } from './chat.repository.js';
import { ChatService } from './chat.service.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

@Module({
  imports: [AuthModule, PlacesModule],
  controllers: [ChatController],
  providers: [ChatRepository, ChatService, RealtimePublisher],
  exports: [ChatService, RealtimePublisher],
})
export class ChatModule {}