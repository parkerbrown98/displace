import { Module } from '@nestjs/common';
import { RealtimePublisher } from './realtime.publisher.js';

@Module({
  providers: [RealtimePublisher],
  exports: [RealtimePublisher],
})
export class RealtimePublisherModule {}