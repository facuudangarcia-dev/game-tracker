import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFriendsAndBlocks1791769449606 implements MigrationInterface {
  name = 'AddFriendsAndBlocks1791769449606';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."friendship_status" AS ENUM('PENDING', 'ACCEPTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "friendships" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "requester_id" uuid NOT NULL, "addressee_id" uuid NOT NULL, "status" "public"."friendship_status" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "accepted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_friendships_accepted_at" CHECK (("status" = 'ACCEPTED') = ("accepted_at" IS NOT NULL)), CONSTRAINT "CHK_friendships_not_self" CHECK ("requester_id" <> "addressee_id"), CONSTRAINT "PK_08af97d0be72942681757f07bc8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_addressee" ON "friendships"  ("addressee_id") `,
    );
    // One friendship per pair of users, whatever the direction of the request.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_friendships_pair" ON "friendships" (LEAST("requester_id", "addressee_id"), GREATEST("requester_id", "addressee_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_blocks" ("blocker_id" uuid NOT NULL, "blocked_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_user_blocks_not_self" CHECK ("blocker_id" <> "blocked_id"), CONSTRAINT "PK_48667515438e7d0f0fed998b193" PRIMARY KEY ("blocker_id", "blocked_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_blocks_blocked" ON "user_blocks"  ("blocked_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."profile_visibility" AS ENUM('FRIENDS', 'PRIVATE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "profile_visibility" "public"."profile_visibility" NOT NULL DEFAULT 'FRIENDS'`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" ADD CONSTRAINT "FK_4cf3c68ed4a5a9fde8d4c2b7319" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" ADD CONSTRAINT "FK_01b0760fd2402d21f12c6dc5f89" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_dfcd8a81016d1de587fbd2d70bf" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_7a0806a54f0ad9ced3e247cacd1" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_7a0806a54f0ad9ced3e247cacd1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_dfcd8a81016d1de587fbd2d70bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" DROP CONSTRAINT "FK_01b0760fd2402d21f12c6dc5f89"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" DROP CONSTRAINT "FK_4cf3c68ed4a5a9fde8d4c2b7319"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "profile_visibility"`);
    await queryRunner.query(`DROP TYPE "public"."profile_visibility"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_blocks_blocked"`);
    await queryRunner.query(`DROP TABLE "user_blocks"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_friendships_pair"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_friendships_addressee"`);
    await queryRunner.query(`DROP TABLE "friendships"`);
    await queryRunner.query(`DROP TYPE "public"."friendship_status"`);
  }
}
