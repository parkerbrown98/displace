import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlacesModule } from '../places/places.module.js';
import { ForumsController, SavedForumsController } from './forums.controller.js';
import { ForumsRepository } from './forums.repository.js';
import { ForumsService } from './forums.service.js';
import { RichTextService } from './rich-text.service.js';
import { TopicViewCounterService } from './topic-view-counter.service.js';

@Module({
  imports: [AuthModule, PlacesModule],
  controllers: [ForumsController, SavedForumsController],
  providers: [
    ForumsRepository,
    ForumsService,
    RichTextService,
    TopicViewCounterService,
  ],
  exports: [ForumsRepository],
})
export class ForumsModule {}