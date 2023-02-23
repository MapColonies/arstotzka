import { MigrationInterface, QueryRunner } from "typeorm";

export class InitalMigration1677159302383 implements MigrationInterface {
    public name = 'initalMigration1677159302383'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "registry"."namespace" (
                "namespace_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_29f23b6fa178d68012fe11feb6b" PRIMARY KEY ("namespace_id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "registry"."rotation" (
                "service_id" uuid NOT NULL,
                "rotation_id" integer NOT NULL,
                "parent_rotation_id" integer,
                "description" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_01ce81db50e037e87a45eea22b8" PRIMARY KEY ("service_id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_c79dd9b127fe6b1a6b3a634027" ON "registry"."rotation" (
                "service_id",
                "parent_rotation_id",
                "rotation_id"
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "registry"."service_parallelism_enum" AS ENUM('single', 'replaceable', 'multiple')
        `);
        await queryRunner.query(`
            CREATE TYPE "registry"."service_service_type_enum" AS ENUM('producer', 'consumer')
        `);
        await queryRunner.query(`
            CREATE TABLE "registry"."service" (
                "service_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "namespace_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "parallelism" "registry"."service_parallelism_enum" NOT NULL,
                "service_type" "registry"."service_service_type_enum" NOT NULL,
                "parent_service_id" uuid,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_48c5a0e13da2b2948fb7f3a0c4a" PRIMARY KEY ("service_id")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "registry"."rotation"
            ADD CONSTRAINT "FK_01ce81db50e037e87a45eea22b8" FOREIGN KEY ("service_id") REFERENCES "registry"."service"("service_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "registry"."service"
            ADD CONSTRAINT "FK_d6aa023b5a1636d681caa9efaee" FOREIGN KEY ("namespace_id") REFERENCES "registry"."namespace"("namespace_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "registry"."service"
            ADD CONSTRAINT "FK_29b7e65d6a987c0c8bdfe995ca1" FOREIGN KEY ("parent_service_id") REFERENCES "registry"."service"("service_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "registry"."service" DROP CONSTRAINT "FK_29b7e65d6a987c0c8bdfe995ca1"
        `);
        await queryRunner.query(`
            ALTER TABLE "registry"."service" DROP CONSTRAINT "FK_d6aa023b5a1636d681caa9efaee"
        `);
        await queryRunner.query(`
            ALTER TABLE "registry"."rotation" DROP CONSTRAINT "FK_01ce81db50e037e87a45eea22b8"
        `);
        await queryRunner.query(`
            DROP TABLE "registry"."service"
        `);
        await queryRunner.query(`
            DROP TYPE "registry"."service_service_type_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "registry"."service_parallelism_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "registry"."IDX_c79dd9b127fe6b1a6b3a634027"
        `);
        await queryRunner.query(`
            DROP TABLE "registry"."rotation"
        `);
        await queryRunner.query(`
            DROP TABLE "registry"."namespace"
        `);
    }
}
