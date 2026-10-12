import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyPlaythroughTime1791410796693 implements MigrationInterface {
  name = 'UnifyPlaythroughTime1791410796693';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'user_game_summaries', 'public'],
    );
    await queryRunner.query(`DROP VIEW "user_game_summaries"`);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'playthrough_times', 'public'],
    );
    await queryRunner.query(`DROP VIEW "playthrough_times"`);
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_manual_time_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_time_mode"`,
    );
    // The manual time becomes the "previous time" and every session now adds to it
    // (decision #61), keeping each playthrough's total:
    // - SESSIONS mode: the manual value was kept but ignored → no previous time.
    // - MANUAL mode with sessions: those sessions came from a SESSIONS period and the
    //   switch to MANUAL copied their sum into the manual time, so the previous time
    //   is what the manual time adds on top of them (never negative).
    await queryRunner.query(
      `UPDATE "playthroughs" SET "manual_time_minutes" = 0 WHERE "time_mode" = 'SESSIONS'`,
    );
    await queryRunner.query(
      `UPDATE "playthroughs" p SET "manual_time_minutes" = GREATEST(p."manual_time_minutes" -
         (SELECT COALESCE(sum(s."duration_minutes"), 0) FROM "gaming_sessions" s
          WHERE s."playthrough_id" = p."id"), 0)
       WHERE p."time_mode" = 'MANUAL'`,
    );
    await queryRunner.query(`ALTER TABLE "playthroughs" DROP COLUMN "time_mode"`);
    await queryRunner.query(
      `ALTER TABLE "playthroughs" RENAME COLUMN "manual_time_minutes" TO "previous_time_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_previous_time_range" CHECK ("previous_time_minutes" >= 0 AND "previous_time_minutes" <= 1000000)`,
    );
    await queryRunner.query(`CREATE VIEW "playthrough_times" AS 
    SELECT p.id AS playthrough_id,
           p.user_game_id AS user_game_id,
           (p.previous_time_minutes + COALESCE(
              (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),
              0
            ))::int AS minutes
    FROM playthroughs p
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'playthrough_times',
        'SELECT p.id AS playthrough_id,\n           p.user_game_id AS user_game_id,\n           (p.previous_time_minutes + COALESCE(\n              (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),\n              0\n            ))::int AS minutes\n    FROM playthroughs p',
      ],
    );
    await queryRunner.query(`CREATE VIEW "user_game_summaries" AS 
    SELECT ug.id AS user_game_id,
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
    GROUP BY ug.id
  `);
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'user_game_summaries', 'public'],
    );
    await queryRunner.query(`DROP VIEW "user_game_summaries"`);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'playthrough_times', 'public'],
    );
    await queryRunner.query(`DROP VIEW "playthrough_times"`);
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_previous_time_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" RENAME COLUMN "previous_time_minutes" TO "manual_time_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD "time_mode" character varying(20) NOT NULL DEFAULT 'MANUAL'`,
    );
    // Restore modes keeping every playthrough's total: with sessions and no previous
    // time → SESSIONS; with both → MANUAL holding the sum (sessions stay, uncounted).
    await queryRunner.query(
      `UPDATE "playthroughs" p SET "time_mode" = 'SESSIONS'
       WHERE p."manual_time_minutes" = 0
         AND EXISTS (SELECT 1 FROM "gaming_sessions" s WHERE s."playthrough_id" = p."id")`,
    );
    await queryRunner.query(
      `UPDATE "playthroughs" p SET "manual_time_minutes" = p."manual_time_minutes" +
         (SELECT COALESCE(sum(s."duration_minutes"), 0) FROM "gaming_sessions" s
          WHERE s."playthrough_id" = p."id")
       WHERE p."time_mode" = 'MANUAL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_time_mode" CHECK (((time_mode)::text = ANY ((ARRAY['MANUAL'::character varying, 'SESSIONS'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_manual_time_range" CHECK (((manual_time_minutes >= 0) AND (manual_time_minutes <= 1000000)))`,
    );
    await queryRunner.query(`CREATE VIEW "playthrough_times" AS SELECT p.id AS playthrough_id,
           p.user_game_id AS user_game_id,
           (CASE
              WHEN p.time_mode = 'MANUAL' THEN p.manual_time_minutes
              ELSE COALESCE(
                (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),
                0
              )
            END)::int AS minutes
    FROM playthroughs p`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'playthrough_times',
        "SELECT p.id AS playthrough_id,\n           p.user_game_id AS user_game_id,\n           (CASE\n              WHEN p.time_mode = 'MANUAL' THEN p.manual_time_minutes\n              ELSE COALESCE(\n                (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),\n                0\n              )\n            END)::int AS minutes\n    FROM playthroughs p",
      ],
    );
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
