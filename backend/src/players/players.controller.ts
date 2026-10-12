import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { CountryQueryDto } from '../deals/country-query.dto';
import { DealsService } from '../deals/deals.service';
import { ListLibraryQueryDto } from '../library/dto/list-library.dto';
import type {
  UserGameDetailsDto,
  UserGameListItemDto,
} from '../library/dto/user-game-response.dto';
import { LibraryService } from '../library/library.service';
import {
  type PlayerHighlightsDto,
  type PlayerStatsDto,
  ProfileService,
} from '../profile/profile.service';
import { type Relation, SocialService } from '../social/social.service';
import { type PublicUserDto, toPublicUser } from '../users/user-response.dto';
import type { User } from '../users/user.entity';
import { type WishlistResponseDto, WishlistService } from '../wishlist/wishlist.service';

export interface PlayerProfileDto {
  user: PublicUserDto & { memberSince: string };
  /** The viewer is looking at their own profile. */
  self: boolean;
  relation: Relation | 'SELF';
  stats: PlayerStatsDto;
  highlights: PlayerHighlightsDto;
}

/**
 * Another player's profile, library and wishlist, read-only (decision #85).
 * Only the owner and their friends (when the owner's profile is visible to
 * friends) get through; everyone else gets 404 USER_NOT_FOUND, and a friend
 * whose profile is private gets 403 PROFILE_PRIVATE.
 */
@Controller('users/:username')
export class PlayersController {
  constructor(
    private readonly social: SocialService,
    private readonly profile: ProfileService,
    private readonly library: LibraryService,
    private readonly wishlist: WishlistService,
    private readonly deals: DealsService,
  ) {}

  @Get('profile')
  async player(
    @CurrentUser() viewer: User,
    @Param('username') username: string,
  ): Promise<PlayerProfileDto> {
    const { user, self } = await this.social.visibleOwner(viewer, username);
    const [stats, highlights] = await Promise.all([
      this.profile.stats(user.id),
      this.profile.highlights(user.id),
    ]);
    return {
      user: { ...toPublicUser(user), memberSince: user.createdAt.toISOString() },
      self,
      relation: self ? 'SELF' : 'FRIEND',
      stats,
      highlights,
    };
  }

  @Get('library')
  async playerLibrary(
    @CurrentUser() viewer: User,
    @Param('username') username: string,
    @Query() query: ListLibraryQueryDto,
  ): Promise<UserGameListItemDto[]> {
    const { user } = await this.social.visibleOwner(viewer, username);
    return this.library.list(user.id, query);
  }

  @Get('library/:userGameId')
  async playerGame(
    @CurrentUser() viewer: User,
    @Param('username') username: string,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
  ): Promise<UserGameDetailsDto> {
    const { user } = await this.social.visibleOwner(viewer, username);
    return this.library.get(user.id, userGameId);
  }

  /** Prices in the viewer's country. */
  @Get('wishlist')
  async playerWishlist(
    @CurrentUser() viewer: User,
    @Param('username') username: string,
    @Query() query: CountryQueryDto,
  ): Promise<WishlistResponseDto> {
    const { user } = await this.social.visibleOwner(viewer, username);
    return this.wishlist.list(user.id, this.deals.country(query.country ?? viewer.country));
  }
}
