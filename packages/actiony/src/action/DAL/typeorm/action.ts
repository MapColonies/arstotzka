import { Column, Entity, CreateDateColumn, UpdateDateColumn, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Action as IAction, ActionStatus } from '../../models/action';

export const ACTION_IDENTIFIER_COLUMN = 'actionId';

@Entity()
export class Action implements IAction {
  @PrimaryGeneratedColumn('uuid', { name: 'action_id' })
  public actionId!: string;

  @Index()
  @Column({ name: 'service_id', type: 'uuid' })
  public serviceId!: string;

  @Column({ name: 'state', type: 'integer' })
  public state!: number;

  @Index()
  @Column({ name: 'namespace_id', type: 'integer' })
  public namespaceId!: number;

  @Column({ name: 'rotation_id', type: 'integer' })
  public rotationId!: number;

  @Column({ name: 'parent_rotation_id', type: 'integer', nullable: true })
  public parentRotationId!: number | null;

  @Column({ name: 'action_status', type: 'enum', enum: ActionStatus, default: ActionStatus.ACTIVE })
  public status!: ActionStatus;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  public metadata!: Record<string, unknown> | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  public closedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
