import { createHmac } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment.js';
import { AuditContextService } from '../platform/audit/audit-context.service.js';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import { CursorCodecService } from '../platform/pagination/cursor-codec.service.js';
import {
  type AddModeratorNoteDto,
  type AssignReportDto,
  type BulkModerationActionDto,
  type CreateModerationActionDto,
  type CreateReportDto,
  type ModerationCursorQueryDto,
  type ResolveReportDto,
} from './moderation.dto.js';
import {
  ModerationRepository,
  type ModerationCursor,
} from './moderation.repository.js';

@Injectable()
export class ModerationService {
  constructor(
    private readonly auditContext: AuditContextService,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly cursors: CursorCodecService,
    private readonly repository: ModerationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  createReport(placeId: string, reporterUserId: string, input: CreateReportDto) {
    const networkHash = createHmac(
      'sha256',
      this.config.get('CURSOR_SECRET', { infer: true }),
    )
      .update(this.auditContext.get().ipAddress)
      .digest('hex');
    return this.repository.createReport(
      placeId,
      reporterUserId,
      input,
      networkHash,
      this.clock.now(),
    );
  }

  async listReports(
    placeId: string,
    actorUserId: string,
    query: ModerationCursorQueryDto,
  ) {
    const records = await this.repository.listReports(placeId, actorUserId, {
      assigneeUserId: query.assigneeUserId,
      cursor: query.cursor ? this.decodeCursor(query.cursor) : undefined,
      limit: query.limit,
      status: query.status,
    });
    const items = records.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        records.length > query.limit && last
          ? this.cursors.encode({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : undefined,
    };
  }

  async getReport(placeId: string, reportId: string, actorUserId: string) {
    const report = await this.repository.getReport(
      placeId,
      reportId,
      actorUserId,
    );
    if (!report) throw new NotFoundException('Report was not found.');
    return report;
  }

  async assignReport(
    placeId: string,
    reportId: string,
    actorUserId: string,
    input: AssignReportDto,
  ) {
    const report = await this.repository.assignReport(
      placeId,
      reportId,
      actorUserId,
      input.assigneeUserId,
      this.clock.now(),
    );
    if (!report) throw new NotFoundException('Open report was not found.');
    return report;
  }

  async resolveReport(
    placeId: string,
    reportId: string,
    actorUserId: string,
    input: ResolveReportDto,
  ) {
    const report = await this.repository.resolveReport(
      placeId,
      reportId,
      actorUserId,
      input.status,
      input.resolution,
      this.clock.now(),
    );
    if (!report) throw new NotFoundException('Open report was not found.');
    return report;
  }

  async addNote(
    placeId: string,
    reportId: string,
    actorUserId: string,
    input: AddModeratorNoteDto,
  ) {
    const note = await this.repository.addNote(
      placeId,
      reportId,
      actorUserId,
      input.body,
    );
    if (!note) throw new NotFoundException('Report was not found.');
    return note;
  }

  executeAction(
    placeId: string,
    actorUserId: string,
    input: CreateModerationActionDto,
  ) {
    return this.repository.executeAction(
      placeId,
      actorUserId,
      input,
      this.clock.now(),
    );
  }

  async executeBulk(
    placeId: string,
    actorUserId: string,
    input: BulkModerationActionDto,
  ) {
    const results = [];
    for (const action of input.actions) {
      results.push(await this.executeAction(placeId, actorUserId, action));
    }
    return { items: results };
  }

  async revokeSanction(
    placeId: string,
    sanctionId: string,
    actorUserId: string,
  ): Promise<void> {
    if (
      !(await this.repository.revokeSanction(
        placeId,
        sanctionId,
        actorUserId,
        this.clock.now(),
      ))
    ) {
      throw new NotFoundException('Active sanction was not found.');
    }
  }

  private decodeCursor(cursor: string): ModerationCursor {
    const value = this.cursors.decode<{ createdAt?: string; id?: string }>(cursor);
    if (!value.createdAt || !value.id) {
      throw new BadRequestException('Moderation cursor is invalid.');
    }
    const createdAt = new Date(value.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException('Moderation cursor is invalid.');
    }
    return { createdAt, id: value.id };
  }
}