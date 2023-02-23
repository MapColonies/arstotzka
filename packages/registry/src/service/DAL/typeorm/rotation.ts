import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';
import { IRotation } from '../../models/service';
import { Service } from './service';

@Entity()
@Index(['serviceId', 'parentRotationId', 'rotationId'], { unique: true })
export class Rotation implements IRotation {
  @PrimaryColumn({ name: 'service_id', type: 'uuid' })
  public serviceId!: string;

  @ManyToOne(() => Service, (service) => service.serviceId)
  @JoinColumn({ name: 'service_id' })
  public service!: Service;

  @Column({ name: 'rotation_id', type: 'integer' })
  public rotationId!: number;

  @Column({ name: 'parent_rotation_id', type: 'integer', nullable: true })
  public parentRotationId!: number;

  @Column({ name: 'description' })
  public description!: string;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
