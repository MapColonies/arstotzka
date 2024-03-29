import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { INamespace } from '../../models/service';
import { Service } from './service';

@Entity()
export class Namespace implements INamespace {
  @PrimaryGeneratedColumn('increment', { name: 'namespace_id', type: 'integer' })
  public namespaceId!: number;

  @Column({ name: 'name' })
  public name!: string;

  @OneToMany(() => Service, (service) => service.namespace)
  public services!: Service[];

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
