import { LockRequest } from '@map-colonies/vector-management-common/src/types/locky';
import { FactoryFunction } from 'tsyringe';
import { ArrayOverlap, DataSource, DeleteResult, IsNull, Raw } from 'typeorm';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { LockId } from '../../models/lock';
import { Lock as LockEntity, LOCK_IDENTIFIER_COLUMN } from './lock';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createLockRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(LockEntity).extend({
    async findNonexpiredLocks(services: string[]): Promise<LockId[]> {
      return this.manager.find(LockEntity, {
        select: [LOCK_IDENTIFIER_COLUMN],
        where: [
          { serviceIds: ArrayOverlap(services), expiresAt: IsNull() },
          { serviceIds: ArrayOverlap(services), expiresAt: Raw((expiration) => `${expiration} > LOCALTIMESTAMP`) },
        ],
      });
    },
    async createLock(lockRequest: LockRequest): Promise<string> {
      const { services, expiration, reason } = lockRequest;

      const expiresAt = expiration !== undefined ? (): string => `LOCALTIMESTAMP + INTERVAL '${expiration} milliseconds'` : null;

      const insertResult = await this.manager
        .createQueryBuilder(LockEntity, 'lock')
        .insert()
        .into(LockEntity)
        .values({ serviceIds: services, expiresAt, reason })
        .returning([LOCK_IDENTIFIER_COLUMN])
        .execute();

      const lockId = insertResult.generatedMaps[0][LOCK_IDENTIFIER_COLUMN] as string;

      return lockId;
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
