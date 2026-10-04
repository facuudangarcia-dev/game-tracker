import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Game } from './game.entity';

@Injectable()
export class GamesService {
  constructor(@InjectRepository(Game) private readonly games: Repository<Game>) {}

  /**
   * Finds a game the user is allowed to see (catalog games, or manual games they
   * created), with its platforms and genres. Returns null otherwise, so callers
   * can't tell another user's manual game apart from a missing one.
   */
  findVisibleById(id: string, userId: string): Promise<Game | null> {
    return this.games.findOne({
      where: [
        { id, createdByUserId: IsNull() },
        { id, createdByUserId: userId },
      ],
      relations: { platforms: true, genres: true },
      order: { platforms: { sortOrder: 'ASC' }, genres: { name: 'ASC' } },
    });
  }
}
