import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import type { EnvironmentVariables } from '../config/env.validation';
import { EmailService } from '../email/email.service';
import type { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { SocialErrorCode } from './social.constants';
import { type ReportReason, UserReport } from './user-report.entity';

const REASON_LABELS: Record<ReportReason, string> = {
  AVATAR: 'Avatar ofensivo',
  USERNAME: 'Username ofensivo',
  OTHER: 'Otro motivo',
};

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/**
 * Reports of offensive avatars or usernames (decision #87): stored and emailed
 * to ADMIN_EMAIL, who acts by hand. The reported user isn't told.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(UserReport) private readonly reports: Repository<UserReport>,
    private readonly users: UsersService,
    private readonly email: EmailService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async report(
    reporter: User,
    username: string,
    reason: ReportReason,
    details: string | null,
  ): Promise<void> {
    const reported = await this.users.findByUsername(username);
    if (!reported || !reported.emailVerified) {
      throw apiError(HttpStatus.NOT_FOUND, SocialErrorCode.UserNotFound, 'User not found');
    }
    if (reported.id === reporter.id) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        SocialErrorCode.CannotReportSelf,
        'Cannot report yourself',
      );
    }
    const saved = await this.reports.save(
      this.reports.create({ reporterId: reporter.id, reportedId: reported.id, reason, details }),
    );

    const to = this.config.get('ADMIN_EMAIL', { infer: true });
    if (!to) {
      this.logger.warn(`Report ${saved.id} stored; ADMIN_EMAIL is not configured`);
      return;
    }
    const lines = [
      `Usuario denunciado: ${reported.username} (id ${reported.id})`,
      `Motivo: ${REASON_LABELS[reason]}`,
      `Detalle: ${details ?? '-'}`,
      `Denunciado por: ${reporter.username}`,
      `Denuncia: ${saved.id} (${saved.createdAt.toISOString()})`,
    ];
    try {
      await this.email.send({
        to,
        subject: `Game Tracker: denuncia de ${reported.username}`,
        text: lines.join('\n'),
        html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(''),
      });
    } catch (error) {
      // The report is stored anyway; the admin can still find it.
      this.logger.warn(`Report ${saved.id} email failed: ${(error as Error).message}`);
    }
  }
}
