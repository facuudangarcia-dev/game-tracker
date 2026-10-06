import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLibrary1791328046821 implements MigrationInterface {
  name = 'CreateLibrary1791328046821';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_games" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "game_id" uuid NOT NULL, "platform_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_user_games_user_game_platform" UNIQUE ("user_id", "game_id", "platform_id"), CONSTRAINT "PK_c9cc6a3afdc17ef440abea3b055" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_user_games_user_id" ON "user_games"  ("user_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_user_games_game_id" ON "user_games"  ("game_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_games_platform_id" ON "user_games"  ("platform_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "playthroughs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_game_id" uuid NOT NULL, "number" integer NOT NULL, "name" character varying(100), "status" character varying(20) NOT NULL DEFAULT 'PENDING', "start_date" date, "completion_date" date, "time_mode" character varying(20) NOT NULL DEFAULT 'MANUAL', "manual_time_minutes" integer NOT NULL DEFAULT '0', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_playthroughs_user_game_number" UNIQUE ("user_game_id", "number"), CONSTRAINT "CHK_playthroughs_notes_length" CHECK (char_length("notes") <= 5000), CONSTRAINT "CHK_playthroughs_name_not_blank" CHECK ("name" IS NULL OR btrim("name") <> ''), CONSTRAINT "CHK_playthroughs_manual_time_range" CHECK ("manual_time_minutes" >= 0 AND "manual_time_minutes" <= 1000000), CONSTRAINT "CHK_playthroughs_completion_after_start" CHECK ("start_date" IS NULL OR "completion_date" IS NULL OR "completion_date" >= "start_date"), CONSTRAINT "CHK_playthroughs_completion_matches_status" CHECK (("status" = 'COMPLETED') = ("completion_date" IS NOT NULL)), CONSTRAINT "CHK_playthroughs_time_mode" CHECK ("time_mode" IN ('MANUAL', 'SESSIONS')), CONSTRAINT "CHK_playthroughs_status" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')), CONSTRAINT "CHK_playthroughs_number_positive" CHECK ("number" >= 1), CONSTRAINT "PK_d47d4bb6907e435cb96e9ef1ca2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD CONSTRAINT "FK_9432b81f913c6e29e5391038981" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD CONSTRAINT "FK_52610929b0f86d508a20769bd9a" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" ADD CONSTRAINT "FK_cbcdd5db768a4d1966cb932c0f7" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "FK_6b639f77d4006550c09ec2fa24c" FOREIGN KEY ("user_game_id") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE VIEW "playthrough_times" AS 
    SELECT p.id AS playthrough_id,
           p.user_game_id AS user_game_id,
           (CASE WHEN p.time_mode = 'MANUAL' THEN p.manual_time_minutes ELSE 0 END)::int AS minutes
    FROM playthroughs p
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'playthrough_times',
        "SELECT p.id AS playthrough_id,\n           p.user_game_id AS user_game_id,\n           (CASE WHEN p.time_mode = 'MANUAL' THEN p.manual_time_minutes ELSE 0 END)::int AS minutes\n    FROM playthroughs p",
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
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "FK_6b639f77d4006550c09ec2fa24c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "FK_cbcdd5db768a4d1966cb932c0f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "FK_52610929b0f86d508a20769bd9a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_games" DROP CONSTRAINT "FK_9432b81f913c6e29e5391038981"`,
    );
    await queryRunner.query(`DROP TABLE "playthroughs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_games_platform_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_games_game_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_games_user_id"`);
    await queryRunner.query(`DROP TABLE "user_games"`);
  }
}
