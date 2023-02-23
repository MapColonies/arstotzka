import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ILock } from '../../models/lock';

const REASON_LENGTH_LIMIT = 255;

@Entity()
export class Lock implements ILock {
    @PrimaryGeneratedColumn('uuid', { name: 'lock_id' })
    public lockId!: string;

    @Index()
    @Column({ name: 'service_ids', type: 'uuid', array: true})
    public serviceIds!: string[];

    @Column({ name: 'reason', length: REASON_LENGTH_LIMIT, nullable: true })
    public reason!: string;

    @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
    public expiresAt!: Date;

    @CreateDateColumn({ name: 'created_at' })
    public createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    public updatedAt!: Date;
}
