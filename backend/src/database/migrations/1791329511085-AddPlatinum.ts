import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatinum1791329511085 implements MigrationInterface {
  name = 'AddPlatinum1791329511085';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD "platinum_achieved" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "user_games" ADD "platinum_date" date`);
    await queryRunner.query(`ALTER TABLE "user_games" ADD "platinum_time_minutes" integer`);
    await queryRunner.query(`ALTER TABLE "user_games" ADD "platinum_difficulty_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD CONSTRAINT "CHK_user_games_platinum_time_range" CHECK ("platinum_time_minutes" IS NULL OR ("platinum_time_minutes" >= 1 AND "platinum_time_minutes" <= 1000000))`,
    );
    await queryRunner.query(`ALTER TABLE "user_games" ADD CONSTRAINT "CHK_user_games_platinum_fields" CHECK ((NOT "platinum_achieved" AND "platinum_date" IS NULL AND "platinum_time_minutes" IS NULL AND "platinum_difficulty_id" IS NULL)
   OR ("platinum_achieved" AND "platinum_date" IS NOT NULL AND "platinum_time_minutes" IS NOT NULL))`);
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD CONSTRAINT "FK_f2dbf66bbee1e002f23291ea16a" FOREIGN KEY ("platinum_difficulty_id") REFERENCES "difficulties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    // Backfill: every existing UserGame gets the default platinum difficulties
    // (new ones get them on creation). Names inlined: migrations are snapshots.
    await queryRunner.query(
      `INSERT INTO "difficulties" ("user_game_id", "kind", "name", "position")
       SELECT ug.id, 'PLATINUM', d.name, d.position
       FROM "user_games" ug
       CROSS JOIN (VALUES ('Muy fácil', 0), ('Fácil', 1), ('Normal', 2), ('Difícil', 3), ('Muy difícil', 4))
         AS d(name, position)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "FK_f2dbf66bbee1e002f23291ea16a"`,
    );
    // Platinum difficulty lists only exist since this migration.
    await queryRunner.query(`DELETE FROM "difficulties" WHERE "kind" = 'PLATINUM'`);
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "CHK_user_games_platinum_fields"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "CHK_user_games_platinum_time_range"`,
    );
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "platinum_difficulty_id"`);
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "platinum_time_minutes"`);
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "platinum_date"`);
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "platinum_achieved"`);
  }
}
