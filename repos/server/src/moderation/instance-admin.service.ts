import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import {
  type AccountStatusActionDto,
  type UpdateInstanceSettingsDto,
} from './moderation.dto.js';
import { InstanceAdminRepository } from './instance-admin.repository.js';

const SECRET_KEY = /(credential|password|private|secret|token|api.?key)/i;

@Injectable()
export class InstanceAdminService {
  constructor(
    private readonly repository: InstanceAdminRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getSettings() {
    const settings = await this.repository.getSettings();
    return {
      ...settings,
      bootstrapAdminConfigured: true,
      secretsManagedExternally: true,
    };
  }

  updateSettings(actorUserId: string, input: UpdateInstanceSettingsDto) {
    if (input.settings) this.rejectSecrets(input.settings);
    return this.repository.updateSettings(actorUserId, input, this.clock.now());
  }

  suspendAccount(actorUserId: string, userId: string, input: AccountStatusActionDto) {
    return this.repository.setAccountStatus(
      actorUserId,
      userId,
      'suspended',
      input.reasonCode,
      input.reason,
      this.clock.now(),
    );
  }

  restoreAccount(actorUserId: string, userId: string, input: AccountStatusActionDto) {
    return this.repository.setAccountStatus(
      actorUserId,
      userId,
      'active',
      input.reasonCode,
      input.reason,
      this.clock.now(),
    );
  }

  private rejectSecrets(value: Record<string, unknown>): void {
    const pending: Array<Record<string, unknown>> = [value];
    while (pending.length) {
      const current = pending.pop()!;
      for (const [key, nested] of Object.entries(current)) {
        if (SECRET_KEY.test(key)) {
          throw new BadRequestException('Secrets must remain environment-managed.');
        }
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          pending.push(nested as Record<string, unknown>);
        }
      }
    }
  }
}