import { FactoryFunction } from 'tsyringe';
import { ArrayOverlap, DataSource, DeleteResult, InsertResult, IsNull, Raw } from 'typeorm';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { LockRequest } from '../../models/lockManager';
import { Lock as LockEntity, LOCK_IDENTIFIER_COLUMN } from './lock';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createLockRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(LockEntity).extend({
    async findNonexpiredLocks(services: string[]): Promise<{ [LOCK_IDENTIFIER_COLUMN]: string }[]> {
      return this.manager.find(LockEntity, {
        select: [LOCK_IDENTIFIER_COLUMN],
        where: [
          { serviceIds: ArrayOverlap(services), expiresAt: IsNull() },
          { serviceIds: ArrayOverlap(services), expiresAt: Raw((expiration) => `${expiration} > NOW()`) },
        ],
      });
    },
    async createLock(lockRequest: LockRequest): Promise<InsertResult> {
      const { services, expiration, reason } = lockRequest;

      const expiresAt = expiration !== undefined ? (): string => `NOW() + INTERVAL '${expiration} milliseconds'` : null;

      return this.manager
        .createQueryBuilder(LockEntity, 'lock')
        .insert()
        .into(LockEntity)
        .values({ serviceIds: services, expiresAt, reason })
        .returning([LOCK_IDENTIFIER_COLUMN])
        .execute();
    },
    async deleteLock(lockId: string): Promise<DeleteResult> {
      return this.manager.createQueryBuilder(LockEntity, 'lock').delete().from(LockEntity).where('lock_id = :lockId', { lockId }).execute();
    },
  });
};

export const LOCK_REPOSITORY_SYMBOL = Symbol('lockRepository');

export type LockRepository = ReturnType<typeof createLockRepository>;

export const lockRepositoryFactory: FactoryFunction<LockRepository> = (depContainer) => {
  const dataSource = depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER);
  return createLockRepository(dataSource);
};
