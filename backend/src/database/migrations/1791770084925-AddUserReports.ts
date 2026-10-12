import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserReports1791770084925 implements MigrationInterface {
  name = 'AddUserReports1791770084925';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."report_reason" AS ENUM('AVATAR', 'USERNAME', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_reports" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "reporter_id" uuid NOT NULL, "reported_id" uuid NOT NULL, "reason" "public"."report_reason" NOT NULL, "details" character varying(500), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d727f04c93f97a3d445a647d234" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_reports_reported" ON "user_reports"  ("reported_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_reports" ADD CONSTRAINT "FK_be1ce509154a3e52ffc50c77904" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_reports" ADD CONSTRAINT "FK_d7b79723d527b6ed5af7b6f43f5" FOREIGN KEY ("reported_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_reports" DROP CONSTRAINT "FK_d7b79723d527b6ed5af7b6f43f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_reports" DROP CONSTRAINT "FK_be1ce509154a3e52ffc50c77904"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_reports_reported"`);
    await queryRunner.query(`DROP TABLE "user_reports"`);
    await queryRunner.query(`DROP TYPE "public"."report_reason"`);
  }
}
