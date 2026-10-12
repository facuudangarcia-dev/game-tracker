import { MigrationInterface, QueryRunner } from 'typeorm';

/** New playthrough status PLAYED (decision #77): allowed by the CHECK and derived by the view. */
export class AddPlayedStatus1791731433017 implements MigrationInterface {
  name = 'AddPlayedStatus1791731433017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_status"`);
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_status" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PLAYED'))`,
    );
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'user_game_summaries', 'public'],
    );
    await queryRunner.query(`DROP VIEW "user_game_summaries"`);
    await queryRunner.query(`CREATE VIEW "user_game_summaries" AS 
    SELECT ug.id AS user_game_id,
           CASE
             WHEN bool_or(p.status = 'IN_PROGRESS') THEN 'IN_PROGRESS'
             WHEN bool_or(p.status = 'COMPLETED') THEN 'COMPLETED'
             WHEN bool_or(p.status = 'PLAYED') THEN 'PLAYED'
             ELSE 'PENDING'
           END AS status,
           to_char(min(p.start_date), 'YYYY-MM-DD') AS start_date,
           to_char(min(p.completion_date), 'YYYY-MM-DD') AS completion_date,
           COALESCE(sum(pt.minutes), 0)::int AS total_minutes
    FROM user_games ug
    LEFT JOIN playthroughs p ON p.user_game_id = ug.id
    LEFT JOIN playthrough_times pt ON pt.playthrough_id = p.id
    GROUP BY ug.id
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'user_game_summaries',
        "SELECT ug.id AS user_game_id,\n           CASE\n             WHEN bool_or(p.status = 'IN_PROGRESS') THEN 'IN_PROGRESS'\n             WHEN bool_or(p.status = 'COMPLETED') THEN 'COMPLETED'\n             WHEN bool_or(p.status = 'PLAYED') THEN 'PLAYED'\n             ELSE 'PENDING'\n           END AS status,\n           to_char(min(p.start_date), 'YYYY-MM-DD') AS start_date,\n           to_char(min(p.completion_date), 'YYYY-MM-DD') AS completion_date,\n           COALESCE(sum(pt.minutes), 0)::int AS total_minutes\n    FROM user_games ug\n    LEFT JOIN playthroughs p ON p.user_game_id = ug.id\n    LEFT JOIN playthrough_times pt ON pt.playthrough_id = p.id\n    GROUP BY ug.id",
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The old statuses don't have PLAYED: those playthroughs go back to IN_PROGRESS.
    await queryRunner.query(
      `UPDATE "playthroughs" SET "status" = 'IN_PROGRESS' WHERE "status" = 'PLAYED'`,
    );
    await queryRunner.query(`ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_status"`);
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_status" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED'))`,
    );
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'user_game_summaries', 'public'],
    );
    await queryRunner.query(`DROP VIEW "user_game_summaries"`);
    await queryRunner.query(`CREATE VIEW "user_game_summaries" AS SELECT ug.id AS user_game_id,
           CASE
             WHEN bool_or(p.status = 'IN_PROGRESS') THEN 'IN_PROGRESS'
             WHEN bool_or(p.status = 'COMPLETED') THEN 'COMPLETED'
             ELSE 'PENDING'
           END AS status,
           to_char(min(p.start_date), 'YYYY-MM-DD') AS start_date,
           to_char(min(p.completion_date), 'YYYY-MM-DD') AS completion_date,
           COALESCE(sum(pt.minutes), 0)::int AS total_minutes
    FROM user_games ug
    LEFT JOIN playthroughs p ON p.user_game_id = ug.id
    LEFT JOIN playthrough_times pt ON pt.playthrough_id = p.id
    GROUP BY ug.id`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'user_game_summaries',
        "SELECT ug.id AS user_game_id,\n           CASE\n             WHEN bool_or(p.status = 'IN_PROGRESS') THEN 'IN_PROGRESS'\n             WHEN bool_or(p.status = 'COMPLETED') THEN 'COMPLETED'\n             ELSE 'PENDING'\n           END AS status,\n           to_char(min(p.start_date), 'YYYY-MM-DD') AS start_date,\n           to_char(min(p.completion_date), 'YYYY-MM-DD') AS completion_date,\n           COALESCE(sum(pt.minutes), 0)::int AS total_minutes\n    FROM user_games ug\n    LEFT JOIN playthroughs p ON p.user_game_id = ug.id\n    LEFT JOIN playthrough_times pt ON pt.playthrough_id = p.id\n    GROUP BY ug.id",
      ],
    );
  }
}
