import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlacesModule } from '../places/places.module.js';
import { ChatController } from './chat.controller.js';
import { ChatRepository } from './chat.repository.js';
import { ChatService } from './chat.service.js';
import { RealtimePublisherModule } from '../realtime/realtime-publisher.module.js';

@Module({
  imports: [AuthModule, PlacesModule, RealtimePublisherModule],
  controllers: [ChatController],
  providers: [ChatRepository, ChatService],
  exports: [ChatService],
})
export class ChatModule {}