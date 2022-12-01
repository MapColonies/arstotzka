import { Column, Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Action as IAction, ActionStatus } from '../../models/action';

@Entity()
export class Action implements IAction {
  @PrimaryColumn({ name: 'action_id', type: 'uuid' })
  public actionId!: string;

  @Index()
  @Column({ name: 'service' })
  public service!: string;

  @Column({ name: 'state', type: 'integer' })
  public state!: number;

  @Column({ name: 'action_status', type: 'enum', enum: ActionStatus })
  public status!: ActionStatus;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  public metadata!: Record<string, unknown>;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  public closedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
