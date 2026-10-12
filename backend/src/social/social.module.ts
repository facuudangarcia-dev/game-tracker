import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsModule } from '../assets/assets.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { Friendship } from './friendship.entity';
import {
  BlocksController,
  FriendsController,
  ReportsController,
  UsersSocialController,
  VisibilityController,
} from './social.controller';
import { SocialService } from './social.service';
import { ReportsService } from './reports.service';
import { UserBlock } from './user-block.entity';
import { UserReport } from './user-report.entity';

/** Friends, blocks, profile visibility (decision #84) and reports (decision #87). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Friendship, UserBlock, UserReport]),
    UsersModule,
    AssetsModule,
    EmailModule,
  ],
  controllers: [
    UsersSocialController,
    FriendsController,
    BlocksController,
    VisibilityController,
    ReportsController,
  ],
  providers: [SocialService, ReportsService],
  exports: [SocialService],
})
export class SocialModule {}
