import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptionalCompletionDate1791698614297 implements MigrationInterface {
  name = 'OptionalCompletionDate1791698614297';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_completion_matches_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_completion_only_completed" CHECK ("completion_date" IS NULL OR "status" = 'COMPLETED')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "CHK_playthroughs_completion_only_completed"`,
    );
    // The old rule requires a date: completed playthroughs without one get the date they were
    // last updated (never before their start date).
    await queryRunner.query(
      `UPDATE "playthroughs" SET "completion_date" = GREATEST("start_date", "updated_at"::date) WHERE "status" = 'COMPLETED' AND "completion_date" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "CHK_playthroughs_completion_matches_status" CHECK ((((status)::text = 'COMPLETED'::text) = (completion_date IS NOT NULL)))`,
    );
  }
}
