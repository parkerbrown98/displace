import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { PlaceMutationPolicy } from '../places/place-mutation-policy.js';
import {
  ModerationActionDto,
  ReportTargetTypeDto,
  type CreateModerationActionDto,
} from './moderation.dto.js';

const TARGETS_BY_ACTION: Record<ModerationActionDto, readonly ReportTargetTypeDto[]> = {
  [ModerationActionDto.Ban]: [ReportTargetTypeDto.Member],
  [ModerationActionDto.ChatDelete]: [ReportTargetTypeDto.ChatMessage],
  [ModerationActionDto.ContentHide]: [ReportTargetTypeDto.Post, ReportTargetTypeDto.Topic],
  [ModerationActionDto.ContentRestore]: [ReportTargetTypeDto.Post, ReportTargetTypeDto.Topic],
  [ModerationActionDto.Timeout]: [ReportTargetTypeDto.Member],
  [ModerationActionDto.TopicLock]: [ReportTargetTypeDto.Topic],
  [ModerationActionDto.TopicMove]: [ReportTargetTypeDto.Topic],
  [ModerationActionDto.TopicPin]: [ReportTargetTypeDto.Topic],
  [ModerationActionDto.TopicUnlock]: [ReportTargetTypeDto.Topic],
  [ModerationActionDto.TopicUnpin]: [ReportTargetTypeDto.Topic],
  [ModerationActionDto.Warn]: [ReportTargetTypeDto.Member],
};

@Injectable()
export class ModerationPolicy {
  requireModerator(actor: PlaceMutationPolicy | undefined): PlaceMutationPolicy {
    if (!actor?.permissions.has('moderation.manage')) {
      throw new ForbiddenException('Moderation management is required.');
    }
    return actor;
  }

  validateAction(input: CreateModerationActionDto): void {
    if (!TARGETS_BY_ACTION[input.action].includes(input.targetType)) {
      throw new BadRequestException('The moderation action does not support this target type.');
    }
    if (input.action === ModerationActionDto.Timeout && !input.durationHours) {
      throw new BadRequestException('A timeout duration is required.');
    }
    if (input.action === ModerationActionDto.TopicMove && !input.targetForumId) {
      throw new BadRequestException('A destination forum is required.');
    }
  }

  requireTargetBelowActor(
    actor: PlaceMutationPolicy,
    target: { isOwner: boolean; position: number },
  ): void {
    if (target.isOwner || target.position >= actor.position) {
      throw new ForbiddenException('A moderator cannot act on an owner or peer role.');
    }
  }
}