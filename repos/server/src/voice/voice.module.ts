import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlacesModule } from '../places/places.module.js';
import { RealtimePublisherModule } from '../realtime/realtime-publisher.module.js';
import { VoiceController, VoiceWebhookController } from './voice.controller.js';
import { VoiceLiveKitService } from './voice-livekit.service.js';
import { VoiceRepository } from './voice.repository.js';
import { VoiceService } from './voice.service.js';

@Module({
  imports: [AuthModule, PlacesModule, RealtimePublisherModule],
  controllers: [VoiceController, VoiceWebhookController],
  providers: [VoiceLiveKitService, VoiceRepository, VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}