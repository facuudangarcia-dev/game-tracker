import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Steam linking and sync, achievements and the history of time changes
 * (decision #78).
 */
export class AddSteamAndAchievements1791736161443 implements MigrationInterface {
  name = 'AddSteamAndAchievements1791736161443';

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
      `CREATE TABLE "achievements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_game_id" uuid NOT NULL, "steam_api_name" character varying(200), "name" character varying(200) NOT NULL, "description" character varying(1000), "name_es" character varying(200), "description_es" character varying(1000), "icon_url" text, "icon_locked_url" text, "hidden" boolean NOT NULL DEFAULT false, "position" integer NOT NULL, "achieved" boolean NOT NULL DEFAULT false, "achieved_at" TIMESTAMP WITH TIME ZONE, "steam_achieved" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_achievements_achieved_at" CHECK ("achieved" OR "achieved_at" IS NULL), CONSTRAINT "CHK_achievements_position" CHECK ("position" >= 0), CONSTRAINT "CHK_achievements_name_not_blank" CHECK (btrim("name") <> ''), CONSTRAINT "PK_1bc19c37c6249f70186f318d71d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_achievements_user_game_position" ON "achievements"  ("user_game_id", "position") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_achievements_user_game_steam" ON "achievements"  ("user_game_id", "steam_api_name") WHERE "steam_api_name" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "playthrough_time_adjustments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "playthrough_id" uuid NOT NULL, "delta_minutes" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e2a27858886f88a277af24a7fa2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_playthrough_time_adjustments_playthrough_id" ON "playthrough_time_adjustments"  ("playthrough_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "steam_accounts" ("user_id" uuid NOT NULL, "steam_id" character varying(17) NOT NULL, "persona_name" character varying(100), "linked_at" TIMESTAMP WITH TIME ZONE NOT NULL, "sync_status" character varying(20) NOT NULL DEFAULT 'IDLE', "sync_error" character varying(40), "sync_started_at" TIMESTAMP WITH TIME ZONE, "sync_done" integer NOT NULL DEFAULT '0', "sync_total" integer NOT NULL DEFAULT '0', "last_synced_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_steam_accounts_sync_status" CHECK ("sync_status" IN ('IDLE', 'SYNCING', 'FAILED')), CONSTRAINT "CHK_steam_accounts_steam_id" CHECK ("steam_id" ~ '^[0-9]{17}$'), CONSTRAINT "PK_4e6d1a9e917a5def274677dd8c8" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_steam_accounts_steam_id" ON "steam_accounts"  ("steam_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "steam_excluded_apps" ("user_id" uuid NOT NULL, "app_id" integer NOT NULL, "name" character varying(200) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e648f5493a1019c22411663f9a5" PRIMARY KEY ("user_id", "app_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD "steam_minutes" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "user_games" ADD "steam_app_id" integer`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_games_user_steam_app" ON "user_games"  ("user_id", "steam_app_id") WHERE "steam_app_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_steam_minutes" CHECK ("steam_minutes" >= 0)`,
    );
    // The previous time may now be negative on Steam games (never below zero overall).
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_previous_time_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_previous_time_range" CHECK ("previous_time_minutes" >= -1000000 AND "previous_time_minutes" <= 1000000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_time_not_negative" CHECK ("previous_time_minutes" + "steam_minutes" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "achievements" ADD CONSTRAINT "FK_a7239a8ace7edc0c9063717356f" FOREIGN KEY ("user_game_id") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthrough_time_adjustments" ADD CONSTRAINT "FK_0499064d6affd12ec1edc28c98c" FOREIGN KEY ("playthrough_id") REFERENCES "playthroughs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "steam_accounts" ADD CONSTRAINT "FK_4e6d1a9e917a5def274677dd8c8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "steam_excluded_apps" ADD CONSTRAINT "FK_9b3946b721e4306584c06d6973a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE VIEW "playthrough_times" AS 
    SELECT p.id AS playthrough_id,
           p.user_game_id AS user_game_id,
           (p.previous_time_minutes + p.steam_minutes + COALESCE(
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
        'SELECT p.id AS playthrough_id,\n           p.user_game_id AS user_game_id,\n           (p.previous_time_minutes + p.steam_minutes + COALESCE(\n              (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),\n              0\n            ))::int AS minutes\n    FROM playthroughs p',
      ],
    );
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
      `ALTER TABLE "steam_excluded_apps" DROP CONSTRAINT "FK_9b3946b721e4306584c06d6973a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "steam_accounts" DROP CONSTRAINT "FK_4e6d1a9e917a5def274677dd8c8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthrough_time_adjustments" DROP CONSTRAINT "FK_0499064d6affd12ec1edc28c98c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "achievements" DROP CONSTRAINT "FK_a7239a8ace7edc0c9063717356f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_time_not_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_steam_minutes"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_user_games_user_steam_app"`);
    await queryRunner.query(`ALTER TABLE "user_games" DROP COLUMN "steam_app_id"`);
    // Steam's time becomes previous time, so no total changes.
    await queryRunner.query(
      `UPDATE "playthroughs" SET "previous_time_minutes" = LEAST("previous_time_minutes" + "steam_minutes", 1000000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_previous_time_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_previous_time_range" CHECK ("previous_time_minutes" >= 0 AND "previous_time_minutes" <= 1000000)`,
    );
    await queryRunner.query(`ALTER TABLE "playthroughs" DROP COLUMN "steam_minutes"`);
    await queryRunner.query(`DROP TABLE "steam_excluded_apps"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_steam_accounts_steam_id"`);
    await queryRunner.query(`DROP TABLE "steam_accounts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_playthrough_time_adjustments_playthrough_id"`,
    );
    await queryRunner.query(`DROP TABLE "playthrough_time_adjustments"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_achievements_user_game_steam"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_achievements_user_game_position"`);
    await queryRunner.query(`DROP TABLE "achievements"`);
    await queryRunner.query(`CREATE VIEW "playthrough_times" AS SELECT p.id AS playthrough_id,
           p.user_game_id AS user_game_id,
           (p.previous_time_minutes + COALESCE(
              (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),
              0
            ))::int AS minutes
    FROM playthroughs p`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'playthrough_times',
        'SELECT p.id AS playthrough_id,\n           p.user_game_id AS user_game_id,\n           (p.previous_time_minutes + COALESCE(\n              (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),\n              0\n            ))::int AS minutes\n    FROM playthroughs p',
      ],
    );
    await queryRunner.query(`CREATE VIEW "user_game_summaries" AS SELECT ug.id AS user_game_id,
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
    GROUP BY ug.id`);
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
}
