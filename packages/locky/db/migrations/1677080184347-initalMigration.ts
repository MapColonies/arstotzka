import { MigrationInterface, QueryRunner } from "typeorm";

export class InitalMigration1677080184347 implements MigrationInterface {
    public name = 'initalMigration1677080184347'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "locky"."lock" (
                "lock_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "service_ids" uuid array NOT NULL,
                "reason" character varying(255),
                "expires_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_3ffc00ceaccfb387b87cf81daa5" PRIMARY KEY ("lock_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_fd158340963dc07b5dc043e989" ON "locky"."lock" ("service_ids")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "locky"."IDX_fd158340963dc07b5dc043e989"
        `);
        await queryRunner.query(`
            DROP TABLE "locky"."lock"
        `);
    }
}
