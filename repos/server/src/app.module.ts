import { Module } from '@nestjs/common';
import { AssetsModule } from './assets/assets.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ForumsModule } from './forums/forums.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PlacesModule } from './places/places.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { SearchModule } from './search/search.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { VoiceModule } from './voice/voice.module.js';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    PlatformModule,
    AuthModule,
    PlacesModule,
    ChatModule,
    AssetsModule,
    ForumsModule,
    ModerationModule,
    JobsModule,
    NotificationsModule,
    SearchModule,
    VoiceModule,
    RealtimeModule,
    HealthModule,
  ],
})
export class AppModule {}
