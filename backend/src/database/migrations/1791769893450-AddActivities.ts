import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivities1791769893450 implements MigrationInterface {
  name = 'AddActivities1791769893450';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."activity_type" AS ENUM('GAME_ADDED', 'STATUS_CHANGED', 'PLATINUM', 'ACHIEVEMENTS', 'RATED', 'FAVORITED', 'WISHLISTED', 'STEAM_IMPORT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "activities" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "type" "public"."activity_type" NOT NULL, "user_game_id" uuid, "game_id" uuid, "game_name" character varying(200), "data" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7f4004429f731ffb9c88eb486a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_user_created" ON "activities"  ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_b82f1d8368dd5305ae7e7e664c2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_59b836819fe91280a9720cbfeda" FOREIGN KEY ("user_game_id") REFERENCES "user_games"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_8de389509493c3be15838823e68" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_8de389509493c3be15838823e68"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_59b836819fe91280a9720cbfeda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_b82f1d8368dd5305ae7e7e664c2"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_activities_user_created"`);
    await queryRunner.query(`DROP TABLE "activities"`);
    await queryRunner.query(`DROP TYPE "public"."activity_type"`);
  }
}
