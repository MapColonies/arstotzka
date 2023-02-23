import { FactoryFunction } from 'tsyringe';
import { DataSource } from 'typeorm';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { Lock as LockEntity } from './lock';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createLockRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(LockEntity).extend({});
};

export const LOCK_REPOSITORY_SYMBOL = Symbol('lockRepository');

export type LockRepository = ReturnType<typeof createLockRepository>;

export const lockRepositoryFactory: FactoryFunction<LockRepository> = (depContainer) => {
  const dataSource = depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER);
  return createLockRepository(dataSource);
};
