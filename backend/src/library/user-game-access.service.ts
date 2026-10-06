import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { LibraryErrorCode } from './library.constants';
import { UserGame } from './user-game.entity';

export function userGameNotFound() {
  return apiError(
    HttpStatus.NOT_FOUND,
    LibraryErrorCode.UserGameNotFound,
    'Game not found in library',
  );
}

/**
 * Ownership check used by the library and every nested resource (playthroughs,
 * sessions, difficulties, platinum). Another user's UserGame is
 * indistinguishable from a missing one: 404, never 403.
 */
@Injectable()
export class UserGameAccess {
  constructor(@InjectRepository(UserGame) private readonly userGames: Repository<UserGame>) {}

  async requireOwned(userId: string, userGameId: string): Promise<UserGame> {
    const userGame = await this.userGames.findOneBy({ id: userGameId, userId });
    if (!userGame) {
      throw userGameNotFound();
    }
    return userGame;
  }
}
