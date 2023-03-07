import { FactoryFunction } from 'tsyringe';
import { DataSource } from 'typeorm';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { DetailedService } from '../../models/service';
import { Service as ServiceEntity } from './service';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createServiceRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(ServiceEntity).extend({
    async findDetailedServiceById(serviceId: string): Promise<DetailedService | null> {
      return this.createQueryBuilder('service')
        .leftJoinAndSelect('service.namespace', 'namespace')
        .leftJoinAndSelect('service.rotations', 'rotation')
        .where('service.service_id = :serviceId', { serviceId })
        .andWhere('rotation.rotation_id IS NOT NULL')
        .orderBy('rotation.parent_rotation', 'DESC', 'NULLS LAST')
        .addOrderBy('rotation.service_rotation', 'DESC')
        .limit(1)
        .getOne();
    },
    async findChildrenById(serviceId: string): Promise<{ serviceId: string }[]> {
      return this.find({ select: ['serviceId'], where: { parentServiceId: serviceId } });
    },
  });
};

export const SERVICE_REPOSITORY_SYMBOL = Symbol('serviceRepository');

export type ServiceRepository = ReturnType<typeof createServiceRepository>;

export const serviceRepositoryFactory: FactoryFunction<ServiceRepository> = (depContainer) => {
  const dataSource = depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER);
  return createServiceRepository(dataSource);
};
