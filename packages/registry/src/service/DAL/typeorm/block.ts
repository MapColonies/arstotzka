import { Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { IBlock } from '../../models/service';
import { Service } from './service';

@Entity()
@Unique(['blockerId', 'blockeeId'])
export class Block implements IBlock {
  @PrimaryColumn({ name: 'blocker_id', type: 'uuid' })
  public blockerId!: string;

  @ManyToOne(() => Service, (service) => service.id)
  @JoinColumn({ name: 'blocker_id' })
  public blockerService!: Service;

  @PrimaryColumn({ name: 'blockee_id', type: 'uuid' })
  public blockeeId!: string;

  @ManyToOne(() => Service, (service) => service.id)
  @JoinColumn({ name: 'blockee_id' })
  public blockeeService!: Service;
}
