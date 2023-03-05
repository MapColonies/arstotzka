import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitalMigration1678019370196 implements MigrationInterface {
  public name = 'InitalMigration1678019370196';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "actiony"."action_action_status_enum" AS ENUM('active', 'completed', 'failed', 'canceled')
        `);
    await queryRunner.query(`
            CREATE TABLE "actiony"."action" (
                "action_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "service_id" uuid NOT NULL,
                "state" integer NOT NULL,
                "namespace_id" integer NOT NULL,
                "rotation_id" integer NOT NULL,
                "parent_rotation_id" integer,
                "action_status" "actiony"."action_action_status_enum" NOT NULL DEFAULT 'active',
                "metadata" jsonb,
                "closed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_5faf700dad0c8b77097ebefa533" PRIMARY KEY ("action_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_0614f35b13efe4dc436c93a034" ON "actiony"."action" ("service_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_c983dca7bde6a51388e5f05d8d" ON "actiony"."action" ("namespace_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "actiony"."IDX_c983dca7bde6a51388e5f05d8d"
        `);
    await queryRunner.query(`
            DROP INDEX "actiony"."IDX_0614f35b13efe4dc436c93a034"
        `);
    await queryRunner.query(`
            DROP TABLE "actiony"."action"
        `);
    await queryRunner.query(`
            DROP TYPE "actiony"."action_action_status_enum"
        `);
  }
}
