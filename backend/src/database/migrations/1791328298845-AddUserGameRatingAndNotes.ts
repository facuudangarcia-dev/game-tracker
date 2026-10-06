import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGameRatingAndNotes1791328298845 implements MigrationInterface {
  name = 'AddUserGameRatingAndNotes1791328298845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_games" ADD "rating" smallint`);
    await queryRunner.query(`ALTER TABLE "user_games" ADD "notes" text`);
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD CONSTRAINT "CHK_user_games_notes_length" CHECK (char_length("notes") <= 5000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD CONSTRAINT "CHK_user_games_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 10 AND "rating" <= 100))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "CHK_user_games_rating_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "CHK_user_games_notes_length"`,
    );
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "notes"`);
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "rating"`);
  }
}
