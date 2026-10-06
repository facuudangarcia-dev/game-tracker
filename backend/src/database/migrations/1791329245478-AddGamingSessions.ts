import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGamingSessions1791329245478 implements MigrationInterface {
  name = 'AddGamingSessions1791329245478';

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
      `CREATE TABLE "gaming_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "playthrough_id" uuid NOT NULL, "played_at" TIMESTAMP WITH TIME ZONE NOT NULL, "duration_minutes" integer NOT NULL, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_gaming_sessions_notes_length" CHECK (char_length("notes") <= 5000), CONSTRAINT "CHK_gaming_sessions_duration_range" CHECK ("duration_minutes" >= 1 AND "duration_minutes" <= 1000000), CONSTRAINT "PK_75207ea480151529bfdb5f7ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gaming_sessions_playthrough_played_at" ON "gaming_sessions"  ("playthrough_id", "played_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "gaming_sessions" ADD CONSTRAINT "FK_75c65e924159d180eda4e9f3d9a" FOREIGN KEY ("playthrough_id") REFERENCES "playthroughs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE VIEW "playthrough_times" AS 
    SELECT p.id AS playthrough_id,
           p.user_game_id AS user_game_id,
           (CASE
              WHEN p.time_mode = 'MANUAL' THEN p.manual_time_minutes
              ELSE COALESCE(
                (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),
                0
              )
            END)::int AS minutes
    FROM playthroughs p
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'playthrough_times',
        "SELECT p.id AS playthrough_id,\n           p.user_game_id AS user_game_id,\n           (CASE\n              WHEN p.time_mode = 'MANUAL' THEN p.manual_time_minutes\n              ELSE COALESCE(\n                (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),\n                0\n              )\n            END)::int AS minutes\n    FROM playthroughs p",
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
      `ALTER TABLE "gaming_sessions" DROP CONSTRAINT "FK_75c65e924159d180eda4e9f3d9a"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_gaming_sessions_playthrough_played_at"`);
    await queryRunner.query(`DROP TABLE "gaming_sessions"`);
    await queryRunner.query(`CREATE VIEW "playthrough_times" AS SELECT p.id AS playthrough_id,
           p.user_game_id AS user_game_id,
           (CASE WHEN p.time_mode = 'MANUAL' THEN p.manual_time_minutes ELSE 0 END)::int AS minutes
    FROM playthroughs p`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'playthrough_times',
        "SELECT p.id AS playthrough_id,\n           p.user_game_id AS user_game_id,\n           (CASE WHEN p.time_mode = 'MANUAL' THEN p.manual_time_minutes ELSE 0 END)::int AS minutes\n    FROM playthroughs p",
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
