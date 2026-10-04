import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogTables1791133408482 implements MigrationInterface {
  name = 'CreateCatalogTables1791133408482';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "genre_external_ids" ("provider" character varying(20) NOT NULL, "external_id" character varying(64) NOT NULL, "genre_id" uuid NOT NULL, CONSTRAINT "PK_792fd36bf6a54e16a48cdcba4ee" PRIMARY KEY ("provider", "external_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_genre_external_ids_genre_id" ON "genre_external_ids"  ("genre_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "genres" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "slug" character varying(100) NOT NULL, "name" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_80ecd718f0f00dde5d77a9be842" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_genres_slug" ON "genres"  ("slug") `);
    await queryRunner.query(
      `CREATE TABLE "platform_external_ids" ("provider" character varying(20) NOT NULL, "external_id" character varying(64) NOT NULL, "platform_id" uuid NOT NULL, CONSTRAINT "PK_5f4f955319fdf14fb426c18b563" PRIMARY KEY ("provider", "external_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_external_ids_platform_id" ON "platform_external_ids"  ("platform_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "platforms" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "slug" character varying(50) NOT NULL, "name" character varying(100) NOT NULL, "short_name" character varying(30) NOT NULL, "sort_order" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3b879853678f7368d46e52b81c6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_platforms_slug" ON "platforms"  ("slug") `);
    await queryRunner.query(`CREATE TABLE "games" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "provider" character varying(20), "external_id" character varying(64), "created_by_user_id" uuid, "name" character varying(255) NOT NULL, "slug" character varying(255), "summary" text, "release_date" date, "developers" text array NOT NULL DEFAULT '{}', "publishers" text array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_games_name_not_blank" CHECK (btrim("name") <> ''), CONSTRAINT "CHK_games_origin" CHECK (("provider" IS NOT NULL AND "external_id" IS NOT NULL AND "created_by_user_id" IS NULL)
   OR ("provider" IS NULL AND "external_id" IS NULL AND "created_by_user_id" IS NOT NULL)), CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id"))`);
    await queryRunner.query(
      `CREATE INDEX "IDX_games_created_by_user_id" ON "games"  ("created_by_user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_games_provider_external_id" ON "games"  ("provider", "external_id") WHERE "provider" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "game_platforms" ("game_id" uuid NOT NULL, "platform_id" uuid NOT NULL, CONSTRAINT "PK_bc1908c8bd4e55552a5b3e77649" PRIMARY KEY ("game_id", "platform_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fe8420bd4e5a1de39654a2e99f" ON "game_platforms"  ("game_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4bc36416ba58bc3f422dfea0bb" ON "game_platforms"  ("platform_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "game_genres" ("game_id" uuid NOT NULL, "genre_id" uuid NOT NULL, CONSTRAINT "PK_f437c920291d8ecfe5c2fef3545" PRIMARY KEY ("game_id", "genre_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97ffde1c44043f6ab2c74c762e" ON "game_genres"  ("game_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ca05b7be44292eb05a1842bbeb" ON "game_genres"  ("genre_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "genre_external_ids" ADD CONSTRAINT "FK_0fa308804dd2f75bb91dc2b5565" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_external_ids" ADD CONSTRAINT "FK_afac03235411b44d0d76447b26e" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD CONSTRAINT "FK_a9f82af3085bc2e0ba28789a322" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_platforms" ADD CONSTRAINT "FK_game_platforms_game_id" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_platforms" ADD CONSTRAINT "FK_game_platforms_platform_id" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_genres" ADD CONSTRAINT "FK_game_genres_game_id" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_genres" ADD CONSTRAINT "FK_game_genres_genre_id" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "game_genres" DROP CONSTRAINT "FK_game_genres_genre_id"`);
    await queryRunner.query(`ALTER TABLE "game_genres" DROP CONSTRAINT "FK_game_genres_game_id"`);
    await queryRunner.query(
      `ALTER TABLE "game_platforms" DROP CONSTRAINT "FK_game_platforms_platform_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_platforms" DROP CONSTRAINT "FK_game_platforms_game_id"`,
    );
    await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "FK_a9f82af3085bc2e0ba28789a322"`);
    await queryRunner.query(
      `ALTER TABLE "platform_external_ids" DROP CONSTRAINT "FK_afac03235411b44d0d76447b26e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "genre_external_ids" DROP CONSTRAINT "FK_0fa308804dd2f75bb91dc2b5565"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ca05b7be44292eb05a1842bbeb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_97ffde1c44043f6ab2c74c762e"`);
    await queryRunner.query(`DROP TABLE "game_genres"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4bc36416ba58bc3f422dfea0bb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fe8420bd4e5a1de39654a2e99f"`);
    await queryRunner.query(`DROP TABLE "game_platforms"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_games_provider_external_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_games_created_by_user_id"`);
    await queryRunner.query(`DROP TABLE "games"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_platforms_slug"`);
    await queryRunner.query(`DROP TABLE "platforms"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_platform_external_ids_platform_id"`);
    await queryRunner.query(`DROP TABLE "platform_external_ids"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_genres_slug"`);
    await queryRunner.query(`DROP TABLE "genres"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_genre_external_ids_genre_id"`);
    await queryRunner.query(`DROP TABLE "genre_external_ids"`);
  }
}
