import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFavoriteGames1791499343327 implements MigrationInterface {
  name = 'AddFavoriteGames1791499343327';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_games" ADD "favorite_at" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "favorite_at"`);
  }
}
