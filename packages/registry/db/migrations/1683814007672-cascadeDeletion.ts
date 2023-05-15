import { MigrationInterface, QueryRunner } from 'typeorm';

export class CascadeDeletion1683814007672 implements MigrationInterface {
  public name = 'cascadeDeletion1683814007672';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "registry"."rotation" DROP CONSTRAINT "FK_01ce81db50e037e87a45eea22b8"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block" DROP CONSTRAINT "FK_e96dbaa5b3dc8bd0ef0f940e344"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block" DROP CONSTRAINT "FK_adf45e1a5eeddaec35bf0d34c8e"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."service" DROP CONSTRAINT "FK_d6aa023b5a1636d681caa9efaee"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block"
            ADD CONSTRAINT "UQ_c077f4ead0dccaa39be2f51fb12" UNIQUE ("blocker_id", "blockee_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."rotation"
            ADD CONSTRAINT "FK_01ce81db50e037e87a45eea22b8" FOREIGN KEY ("service_id") REFERENCES "registry"."service"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block"
            ADD CONSTRAINT "FK_e96dbaa5b3dc8bd0ef0f940e344" FOREIGN KEY ("blocker_id") REFERENCES "registry"."service"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block"
            ADD CONSTRAINT "FK_adf45e1a5eeddaec35bf0d34c8e" FOREIGN KEY ("blockee_id") REFERENCES "registry"."service"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."service"
            ADD CONSTRAINT "FK_d6aa023b5a1636d681caa9efaee" FOREIGN KEY ("namespace_id") REFERENCES "registry"."namespace"("namespace_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "registry"."service" DROP CONSTRAINT "FK_d6aa023b5a1636d681caa9efaee"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block" DROP CONSTRAINT "FK_adf45e1a5eeddaec35bf0d34c8e"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block" DROP CONSTRAINT "FK_e96dbaa5b3dc8bd0ef0f940e344"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."rotation" DROP CONSTRAINT "FK_01ce81db50e037e87a45eea22b8"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block" DROP CONSTRAINT "UQ_c077f4ead0dccaa39be2f51fb12"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."service"
            ADD CONSTRAINT "FK_d6aa023b5a1636d681caa9efaee" FOREIGN KEY ("namespace_id") REFERENCES "registry"."namespace"("namespace_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block"
            ADD CONSTRAINT "FK_adf45e1a5eeddaec35bf0d34c8e" FOREIGN KEY ("blockee_id") REFERENCES "registry"."service"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block"
            ADD CONSTRAINT "FK_e96dbaa5b3dc8bd0ef0f940e344" FOREIGN KEY ("blocker_id") REFERENCES "registry"."service"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."rotation"
            ADD CONSTRAINT "FK_01ce81db50e037e87a45eea22b8" FOREIGN KEY ("service_id") REFERENCES "registry"."service"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }
}
