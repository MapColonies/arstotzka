import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddedBlockTable1678879390553 implements MigrationInterface {
  public name = 'addedBlockTable1678879390553';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "registry"."block" (
                "blocker_id" uuid NOT NULL,
                "blockee_id" uuid NOT NULL,
                CONSTRAINT "UQ_c077f4ead0dccaa39be2f51fb12" UNIQUE ("blocker_id", "blockee_id"),
                CONSTRAINT "PK_c077f4ead0dccaa39be2f51fb12" PRIMARY KEY ("blocker_id", "blockee_id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block"
            ADD CONSTRAINT "FK_e96dbaa5b3dc8bd0ef0f940e344" FOREIGN KEY ("blocker_id") REFERENCES "registry"."service"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block"
            ADD CONSTRAINT "FK_adf45e1a5eeddaec35bf0d34c8e" FOREIGN KEY ("blockee_id") REFERENCES "registry"."service"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "registry"."block" DROP CONSTRAINT "FK_adf45e1a5eeddaec35bf0d34c8e"
        `);
    await queryRunner.query(`
            ALTER TABLE "registry"."block" DROP CONSTRAINT "FK_e96dbaa5b3dc8bd0ef0f940e344"
        `);
    await queryRunner.query(`
            DROP TABLE "registry"."block"
        `);
  }
}
