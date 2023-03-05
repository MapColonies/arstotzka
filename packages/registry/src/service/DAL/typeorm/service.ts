import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { IService, Parallelism, ServiceType } from '../../models/service';
import { Namespace } from './namespace';
import { Rotation } from './rotation';

@Entity()
export class Service implements IService {
  @PrimaryGeneratedColumn('uuid', { name: 'service_id' })
  public serviceId!: string;

  @Column({ name: 'namespace_id', type: 'integer' })
  public namespaceId!: number;

  @ManyToOne(() => Namespace, (namespace) => namespace.services)
  @JoinColumn({ name: 'namespace_id', referencedColumnName: 'namespaceId' })
  public namespace!: Namespace;

  @Column({ name: 'name' })
  public name!: string;

  @Column({ name: 'parallelism', type: 'enum', enum: Parallelism })
  public parallalism!: Parallelism;

  @Column({ name: 'service_type', type: 'enum', enum: ServiceType })
  public serviceType!: ServiceType;

  @Column({ name: 'parent_service_id', type: 'uuid', nullable: true })
  public parentServiceId!: string | null;

  @ManyToOne(() => Service, (service) => service.serviceId)
  @JoinColumn({ name: 'parent_service_id' })
  public parent?: Service;

  @OneToMany(() => Service, (service) => service.parent)
  public children!: Service[];

  @OneToMany(() => Rotation, (rotation) => rotation.service)
  public rotations!: Rotation[];

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
