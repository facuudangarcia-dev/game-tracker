import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { isFutureTimestamp } from '../common/dates';
import type { CreateSessionDto, SessionResponseDto, UpdateSessionDto } from './dto/session.dto';
import { GamingSession } from './gaming-session.entity';
import { LibraryErrorCode } from './library.constants';
import { PlaythroughsService } from './playthroughs.service';
import { UserGameAccess } from './user-game-access.service';

/**
 * Sessions of playthroughs. Every session belongs to a playthrough and adds its
 * duration to that playthrough's time (docs/decisions.md #61). Integer minutes.
 */
@Injectable()
export class PlaytimeService {
  constructor(
    @InjectRepository(GamingSession) private readonly sessions: Repository<GamingSession>,
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
    }));
  }

  async list(userId: string, userGameId: string): Promise<SessionResponseDto[]> {
    await this.access.requireOwned(userId, userGameId);
    return this.listFor(userGameId);
  }

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
