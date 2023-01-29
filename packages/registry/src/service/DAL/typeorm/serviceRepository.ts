import { FactoryFunction } from 'tsyringe';
import { DataSource } from 'typeorm';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { Service as ServiceEntity } from './service';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createServiceRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(ServiceEntity).extend({});
};

export const SERVICE_REPOSITORY_SYMBOL = Symbol('serviceRepository');

export type ServiceRepository = ReturnType<typeof createServiceRepository>;

export const serviceRepositoryFactory: FactoryFunction<ServiceRepository> = (depContainer) => {
  const dataSource = depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER);
  return createServiceRepository(dataSource);
};
