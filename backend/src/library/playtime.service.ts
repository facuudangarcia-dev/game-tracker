import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { isFutureTimestamp } from '../common/dates';
import type {
  ChangeTimeModeDto,
  CreateSessionDto,
  SessionResponseDto,
  UpdateSessionDto,
} from './dto/session.dto';
import { GamingSession } from './gaming-session.entity';
import { LibraryErrorCode, TimeMode } from './library.constants';
import { Playthrough } from './playthrough.entity';
import { PlaythroughsService } from './playthroughs.service';
import { UserGameAccess } from './user-game-access.service';

/**
 * Playtime of playthroughs: sessions, manual time and switching between the
 * two modes without losing time. Time is always integer minutes.
 */
@Injectable()
export class PlaytimeService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GamingSession) private readonly sessions: Repository<GamingSession>,
    @InjectRepository(Playthrough) private readonly playthroughs: Repository<Playthrough>,
    private readonly access: UserGameAccess,
    private readonly playthroughsService: PlaythroughsService,
  ) {}

  /** All sessions of a UserGame, most recent first. */
  async listFor(userGameId: string): Promise<SessionResponseDto[]> {
    const rows = await this.sessions.find({
      where: { playthrough: { userGameId } },
      relations: { playthrough: true },
      order: { playedAt: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((session) => ({
      id: session.id,
      playthroughId: session.playthroughId,
      playthroughNumber: session.playthrough.number,
      playedAt: session.playedAt.toISOString(),
      durationMinutes: session.durationMinutes,
      notes: session.notes,
      countsTowardTime: session.playthrough.timeMode === TimeMode.Sessions,
    }));
  }

  async list(userId: string, userGameId: string): Promise<SessionResponseDto[]> {
    await this.access.requireOwned(userId, userGameId);
    return this.listFor(userGameId);
  }

  /** Sessions can only be added to playthroughs in SESSIONS mode. */
  async createSession(
    userId: string,
    userGameId: string,
    playthroughId: string,
    dto: CreateSessionDto,
  ): Promise<void> {
    const playthrough = await this.playthroughsService.requirePlaythrough(
      userId,
      userGameId,
      playthroughId,
    );
    if (playthrough.timeMode !== TimeMode.Sessions) {
      throw apiError(
        HttpStatus.CONFLICT,
        LibraryErrorCode.SessionsRequireSessionMode,
        'Sessions can only be added to playthroughs in SESSIONS mode',
      );
    }
    await this.sessions.insert({
      playthroughId: playthrough.id,
      playedAt: notInFuture(dto.playedAt),
      durationMinutes: dto.durationMinutes,
      notes: dto.notes ?? null,
    });
  }

  async updateSession(
    userId: string,
    userGameId: string,
    sessionId: string,
    dto: UpdateSessionDto,
  ): Promise<void> {
    const session = await this.requireSession(userId, userGameId, sessionId);
    await this.sessions.update(
      { id: session.id },
      {
        ...(dto.playedAt !== undefined && { playedAt: notInFuture(dto.playedAt) }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    );
  }

  async removeSession(userId: string, userGameId: string, sessionId: string): Promise<void> {
    const session = await this.requireSession(userId, userGameId, sessionId);
    await this.sessions.delete({ id: session.id });
  }

  /** Explicit edit of a MANUAL playthrough's total time. */
  async setManualTime(
    userId: string,
    userGameId: string,
    playthroughId: string,
    minutes: number,
  ): Promise<void> {
    const playthrough = await this.playthroughsService.requirePlaythrough(
      userId,
      userGameId,
      playthroughId,
    );
    if (playthrough.timeMode !== TimeMode.Manual) {
      throw apiError(
        HttpStatus.CONFLICT,
        LibraryErrorCode.ManualTimeRequiresManualMode,
        'The time of a SESSIONS playthrough is the sum of its sessions',
      );
    }
    await this.playthroughs.update({ id: playthrough.id }, { manualTimeMinutes: minutes });
  }

  /**
   * MANUAL → SESSIONS: optionally turns the manual time into an initial session.
   * SESSIONS → MANUAL: the current sessions total becomes the manual time;
   * sessions are kept but stop counting while in MANUAL mode.
   */
  async changeTimeMode(
    userId: string,
    userGameId: string,
    playthroughId: string,
    dto: ChangeTimeModeDto,
  ): Promise<void> {
    const playthrough = await this.playthroughsService.requirePlaythrough(
      userId,
      userGameId,
      playthroughId,
    );
    if (playthrough.timeMode === dto.mode) {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const playthroughRepository = manager.getRepository(Playthrough);
      if (dto.mode === TimeMode.Sessions) {
        if (dto.initialSession && playthrough.manualTimeMinutes > 0) {
          await manager.getRepository(GamingSession).insert({
            playthroughId: playthrough.id,
            playedAt: notInFuture(dto.initialSession.playedAt),
            durationMinutes: playthrough.manualTimeMinutes,
            notes: null,
          });
        }
        await playthroughRepository.update({ id: playthrough.id }, { timeMode: TimeMode.Sessions });
        return;
      }

      const { total } = (await manager
        .getRepository(GamingSession)
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.duration_minutes), 0)', 'total')
        .where('s.playthrough_id = :id', { id: playthrough.id })
        .getRawOne<{ total: string }>())!;
      await playthroughRepository.update(
        { id: playthrough.id },
        { timeMode: TimeMode.Manual, manualTimeMinutes: Number(total) },
      );
    });
  }

  private async requireSession(
    userId: string,
    userGameId: string,
    sessionId: string,
  ): Promise<GamingSession> {
    await this.access.requireOwned(userId, userGameId);
    const session = await this.sessions.findOne({
      where: { id: sessionId, playthrough: { userGameId } },
    });
    if (!session) {
      throw apiError(HttpStatus.NOT_FOUND, LibraryErrorCode.SessionNotFound, 'Session not found');
    }
    return session;
  }
}

function notInFuture(isoTimestamp: string): Date {
  const playedAt = new Date(isoTimestamp);
  if (isFutureTimestamp(playedAt)) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      LibraryErrorCode.DateInFuture,
      'A session cannot be in the future',
    );
  }
  return playedAt;
}
