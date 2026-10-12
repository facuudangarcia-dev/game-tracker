import { MigrationInterface, QueryRunner } from 'typeorm';

export class SteamAllAchieved1791755968542 implements MigrationInterface {
  name = 'SteamAllAchieved1791755968542';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD "steam_all_achieved" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "steam_all_achieved"`);
  }
}
