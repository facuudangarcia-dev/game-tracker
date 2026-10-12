import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { LibraryModule } from '../library/library.module';
import { ProfileModule } from '../profile/profile.module';
import { SocialModule } from '../social/social.module';
import { WishlistModule } from '../wishlist/wishlist.module';
import { PlayersController } from './players.controller';

/** Other players' profiles, read-only (decision #85). */
@Module({
  imports: [SocialModule, ProfileModule, LibraryModule, WishlistModule, DealsModule],
  controllers: [PlayersController],
})
export class PlayersModule {}
