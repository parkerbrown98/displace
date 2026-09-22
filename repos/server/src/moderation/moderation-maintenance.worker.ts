import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { and, inArray, lt } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  moderationReports,
  moderationSignals,
  moderatorNotes,
} from '../database/schema/index.js';

@Injectable()
export class ModerationMaintenanceWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ModerationMaintenanceWorker.name);
  private running?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(@Inject(DATABASE) private readonly database: Database) {}

  onApplicationBootstrap(): void {
    this.run();
    this.timer = setInterval(() => this.run(), 24 * 60 * 60 * 1_000);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  private run(): void {
    if (this.running) return;
    this.running = this.cleanup()
      .catch((error: unknown) => {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Moderation retention cleanup failed',
        );
      })
      .finally(() => {
        this.running = undefined;
      });
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    await this.database
      .delete(moderationSignals)
      .where(lt(moderationSignals.expiresAt, now));

    const retentionBoundary = new Date(
      now.getTime() - 180 * 24 * 60 * 60 * 1_000,
    );
    const staleReports = await this.database
      .select({ id: moderationReports.id })
      .from(moderationReports)
      .where(
        and(
          inArray(moderationReports.status, ['resolved', 'dismissed']),
          lt(moderationReports.resolvedAt, retentionBoundary),
        ),
      )
      .limit(500);
    if (!staleReports.length) return;
    const reportIds = staleReports.map((report) => report.id);
    await this.database.transaction(async (transaction) => {
      await transaction
        .delete(moderatorNotes)
        .where(inArray(moderatorNotes.reportId, reportIds));
      await transaction
        .update(moderationReports)
        .set({ details: '', evidence: { retained: false } })
        .where(inArray(moderationReports.id, reportIds));
    });
  }
}