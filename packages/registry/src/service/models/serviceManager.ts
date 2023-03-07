import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ServiceRepository, SERVICE_REPOSITORY_SYMBOL } from '../DAL/typeorm/serviceRepository';
import { getActiveActionsMock } from './actionyMock';
import { ServiceIsActiveError, ServiceNotFoundError } from './errors';
import { lockServicesMock, unlockServicesMock } from './lockyMock';
import { DetailedService, FlattedDetailedService } from './service';

const flattenDetailedService = (service: DetailedService, children: { serviceId: string }[]): FlattedDetailedService => {
  const { namespace, name: serviceName, serviceType, serviceId, parallelism, parentServiceId: parent, rotations, createdAt, updatedAt } = service;
  const { namespaceId, name: namespaceName } = namespace;
  const { serviceRotation, parentRotation } = rotations[0];

  return {
    namespaceId,
    namespaceName,
    serviceId,
    serviceName,
    serviceType,
    parallelism,
    serviceRotation,
    parent,
    parentRotation,
    children: children.map((child) => child.serviceId),
    createdAt,
    updatedAt,
  };
};

@injectable()
export class ServiceManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICE_REPOSITORY_SYMBOL) private readonly serviceRepository: ServiceRepository
  ) {}

  public async detail(serviceId: string): Promise<FlattedDetailedService> {
    this.logger.info({ msg: 'detailing service', serviceId });

    const service = await this.serviceRepository.findDetailedServiceById(serviceId);

    if (service === null) {
      this.logger.error({ msg: 'service not found', serviceId });
      throw new ServiceNotFoundError(`service ${serviceId} not found`);
    }

    const children = await this.serviceRepository.findChildrenById(serviceId);

    return flattenDetailedService(service, children);
  }

  public async rotate(serviceId: string): Promise<void> {
    this.logger.info({ msg: 'rotating service', serviceId });

    const service = await this.serviceRepository.findOneBy({ serviceId });

    if (service === null) {
      this.logger.error({ msg: 'service not found', serviceId });
      throw new ServiceNotFoundError(`service ${serviceId} not found`);
    }

    const children = await this.serviceRepository.findChildrenById(serviceId);

    const services = [service.serviceId, ...children.map((child) => child.serviceId)];

    this.logger.info({ msg: 'locking services', services });
    // TODO: lock service and its children
    const lock = await lockServicesMock({ services, expiration: 1000 });

    this.logger.info({ msg: 'locked services', services, lock });

    try {
      for await (const service of services) {
        const activeActions = await getActiveActionsMock(service);
        if (activeActions.length > 0) {
          throw new ServiceIsActiveError(`service ${serviceId} has active actions`);
        }
      }
    } catch (error) {
      if (error instanceof ServiceIsActiveError) {
        this.logger.error({ msg: `service ${serviceId} has active actions`, err: error, serviceId });
      } else {
        this.logger.error({ msg: `could not determine ${serviceId} active actions`, err: error, serviceId });
      }

      this.logger.info({ msg: 'unlocking services', services, lock });
      // TODO: this could also fail
      await unlockServicesMock(lock.lockId);

      throw error;
    }

    // TODO: rotate

    this.logger.info({ msg: 'unlocking services', services, lock });
    await unlockServicesMock(lock.lockId);
  }
}
