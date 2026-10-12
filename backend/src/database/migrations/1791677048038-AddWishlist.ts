import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWishlist1791677048038 implements MigrationInterface {
  name = 'AddWishlist1791677048038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "wishlist_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "game_id" uuid NOT NULL, "target_price" numeric(12,2), "target_currency" character(3), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_wishlist_items_user_game" UNIQUE ("user_id", "game_id"), CONSTRAINT "CHK_wishlist_items_target_price" CHECK (("target_price" IS NULL AND "target_currency" IS NULL)
   OR ("target_price" > 0 AND "target_currency" ~ '^[A-Z]{3}$')), CONSTRAINT "PK_0bd52924a97cda208ed2a07bd69" PRIMARY KEY ("id"))`);
    await queryRunner.query(
      `CREATE INDEX "IDX_wishlist_items_user_id" ON "wishlist_items"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wishlist_items_game_id" ON "wishlist_items"  ("game_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_items" ADD CONSTRAINT "FK_549f44d8b756e2690deb099f83b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_items" ADD CONSTRAINT "FK_404895f5eab8a8f3f2eb9f0ea28" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wishlist_items" DROP CONSTRAINT "FK_404895f5eab8a8f3f2eb9f0ea28"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_items" DROP CONSTRAINT "FK_549f44d8b756e2690deb099f83b"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_wishlist_items_game_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_wishlist_items_user_id"`);
    await queryRunner.query(`DROP TABLE "wishlist_items"`);
  }
}
