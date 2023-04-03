import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Tree,
  TreeChildren,
  TreeParent,
  UpdateDateColumn,
} from 'typeorm';
import { Parallelism, ServiceType } from '@map-colonies/arstotzka-common';
import { IService } from '../../models/service';
import { Namespace } from './namespace';
import { Rotation } from './rotation';
import { Block } from './block';

@Entity()
@Tree('closure-table')
export class Service implements IService {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  public id!: string;

  @Column({ name: 'namespace_id', type: 'integer' })
  public namespaceId!: number;

  @ManyToOne(() => Namespace, (namespace) => namespace.services)
  @JoinColumn({ name: 'namespace_id', referencedColumnName: 'namespaceId' })
  public namespace!: Namespace;

  @Column({ name: 'name' })
  public name!: string;

  @Column({ name: 'parallelism', type: 'enum', enum: Parallelism })
  public parallelism!: Parallelism;

  @Column({ name: 'service_type', type: 'enum', enum: ServiceType })
  public serviceType!: ServiceType;

  @Column({ name: 'parent_service_id', type: 'uuid', nullable: true })
  public parentServiceId!: string | null;

  @ManyToOne(() => Service, (service) => service.children)
  @JoinColumn({ name: 'parent_service_id' })
  @TreeParent()
  public parent?: Service | null;

  @OneToMany(() => Service, (service) => service.parent)
  @TreeChildren()
  public children!: Service[];

  @OneToMany(() => Rotation, (rotation) => rotation.service)
  @JoinColumn({ referencedColumnName: 'id' })
  public rotations!: Rotation[];

  @OneToMany(() => Block, (block) => block.blockerService)
  @JoinColumn({ referencedColumnName: 'id' })
  public blocks!: Block[];

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
