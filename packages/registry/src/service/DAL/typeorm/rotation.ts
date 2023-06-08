import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { IRotation } from '../../models/service';
import { Service } from './service';

const DESCRIPTION_LENGTH_LIMIT = 255;

export const ROTATION_IDENTIFIER_COLUMN = 'rotationId';

@Entity()
@Index(['serviceId', 'parentRotation', 'serviceRotation'], { unique: true, where: '"parent_rotation" IS NOT NULL' })
@Index(['serviceId', 'serviceRotation'], { unique: true, where: '"parent_rotation" IS NULL' })
export class Rotation implements IRotation {
  @PrimaryGeneratedColumn('uuid', { name: 'rotation_id' })
  public rotationId!: string;

  @Column({ name: 'service_id', type: 'uuid' })
  public serviceId!: string;

  @ManyToOne(() => Service, (service) => service.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  public service!: Service;

  @Column({ name: 'service_rotation', type: 'integer' })
  public serviceRotation!: number;

  @Column({ name: 'parent_rotation', type: 'integer', nullable: true })
  public parentRotation!: number | null;

  @Column({ name: 'description', type: 'character varying', length: DESCRIPTION_LENGTH_LIMIT, nullable: true })
  public description!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
