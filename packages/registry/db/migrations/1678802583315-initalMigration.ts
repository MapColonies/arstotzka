import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitalMigration1678802583315 implements MigrationInterface {
  public name = 'initalMigration1678802583315';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "registry"."namespace" (
                "namespace_id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_29f23b6fa178d68012fe11feb6b" PRIMARY KEY ("namespace_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "registry"."rotation" (
                "rotation_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "service_id" uuid NOT NULL,
                "service_rotation" integer NOT NULL,
                "parent_rotation" integer,
                "description" character varying(255),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_64a205f46005940192c1da3cb23" PRIMARY KEY ("rotation_id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_c789d5eb7a282567f625e64930" ON "registry"."rotation" ("service_id", "service_rotation")
            WHERE "parent_rotation" IS NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_1724ad396cc756824771ffcea8" ON "registry"."rotation" (
                "service_id",
                "parent_rotation",
                "service_rotation"
            )
            WHERE "parent_rotation" IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE TYPE "registry"."service_parallelism_enum" AS ENUM('single', 'replaceable', 'multiple')
        `);
    await queryRunner.query(`
            CREATE TYPE "registry"."service_service_type_enum" AS ENUM('producer', 'consumer')
        `);
    await queryRunner.query(`
            CREATE TABLE "registry"."service" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "namespace_id" integer NOT NULL,
                "name" character varying NOT NULL,
                "parallelism" "registry"."service_parallelism_enum" NOT NULL,
                "service_type" "registry"."service_service_type_enum" NOT NULL,
                "parent_service_id" uuid,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "registry"."service_closure" (
                "id_ancestor" uuid NOT NULL,
                "id_descendant" uuid NOT NULL,
                CONSTRAINT "PK_8bd17ea3baf7e6246526b115e12" PRIMARY KEY ("id_ancestor", "id_descendant")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_4cf4c5689024ba40911061803f" ON "registry"."service_closure" ("id_ancestor")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_db8ce8417c184a1e246cccdf59" ON "registry"."service_closure" ("id_descendant")
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."rotation"
            ADD CONSTRAINT "FK_01ce81db50e037e87a45eea22b8" FOREIGN KEY ("service_id") REFERENCES "registry"."service"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."service"
            ADD CONSTRAINT "FK_d6aa023b5a1636d681caa9efaee" FOREIGN KEY ("namespace_id") REFERENCES "registry"."namespace"("namespace_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."service"
            ADD CONSTRAINT "FK_29b7e65d6a987c0c8bdfe995ca1" FOREIGN KEY ("parent_service_id") REFERENCES "registry"."service"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."service_closure"
            ADD CONSTRAINT "FK_4cf4c5689024ba40911061803fa" FOREIGN KEY ("id_ancestor") REFERENCES "registry"."service"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."service_closure"
            ADD CONSTRAINT "FK_db8ce8417c184a1e246cccdf592" FOREIGN KEY ("id_descendant") REFERENCES "registry"."service"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "registry"."service_closure" DROP CONSTRAINT "FK_db8ce8417c184a1e246cccdf592"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."service_closure" DROP CONSTRAINT "FK_4cf4c5689024ba40911061803fa"
        `);
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
            DROP INDEX "registry"."IDX_db8ce8417c184a1e246cccdf59"
        `);
    await queryRunner.query(`
            DROP INDEX "registry"."IDX_4cf4c5689024ba40911061803f"
        `);
    await queryRunner.query(`
            DROP TABLE "registry"."service_closure"
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
            DROP INDEX "registry"."IDX_1724ad396cc756824771ffcea8"
        `);
    await queryRunner.query(`
            DROP INDEX "registry"."IDX_c789d5eb7a282567f625e64930"
        `);
    await queryRunner.query(`
            DROP TABLE "registry"."rotation"
        `);
    await queryRunner.query(`
            DROP TABLE "registry"."namespace"
        `);
  }
}
