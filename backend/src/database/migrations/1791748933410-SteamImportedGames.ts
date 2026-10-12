import { MigrationInterface, QueryRunner } from 'typeorm';

export class SteamImportedGames1791748933410 implements MigrationInterface {
  name = 'SteamImportedGames1791748933410';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD "steam_imported" boolean NOT NULL DEFAULT false`,
    );
    // Before this migration the origin wasn't stored: every linked game counts as imported.
    await queryRunner.query(
      `UPDATE "user_games" SET "steam_imported" = true WHERE "steam_app_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD CONSTRAINT "CHK_user_games_steam_imported" CHECK (NOT "steam_imported" OR "steam_app_id" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "CHK_user_games_steam_imported"`,
    );
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "steam_imported"`);
  }
}
