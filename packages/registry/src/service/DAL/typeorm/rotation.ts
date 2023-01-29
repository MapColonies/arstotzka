import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { IRotation } from '../../models/service';
import { Service } from './service';

@Entity()
export class Rotation implements IRotation {
  @PrimaryColumn({ name: 'service_id', type: 'uuid' })
  public serviceId!: string;

  @ManyToOne(() => Service, (service) => service.serviceId)
  @JoinColumn({ name: 'service_id' })
  public service!: Service;

  @PrimaryGeneratedColumn('increment', { name: 'rotation_id' })
  public rotationId!: number;

  @Column({ name: 'description' })
  public description!: string;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
