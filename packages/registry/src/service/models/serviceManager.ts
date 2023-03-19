import { Logger } from '@map-colonies/js-logger';
import { IMediator } from '@map-colonies/mediator';
import { ActionStatus } from '@map-colonies/vector-management-common';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { Service } from '../DAL/typeorm/service';
import { ServiceRepository, SERVICE_REPOSITORY_SYMBOL } from '../DAL/typeorm/serviceRepository';
import { ServiceIsActiveError, ServiceNotFoundError } from './errors';
import { DetailedService, FlattedDetailedService } from './service';

const ROTATION_LOCK_EXPIRATION_MS = 60000;

const flattenDetailedService = (service: Required<DetailedService>, children: string[]): FlattedDetailedService => {
  const {
    namespace,
    name: serviceName,
    serviceType,
    id: serviceId,
    parallelism,
    parentServiceId: parent,
    rotations,
    blocks,
    createdAt,
    updatedAt,
  } = service;
  const { namespaceId, name: namespaceName } = namespace;
  const { serviceRotation, parentRotation } = rotations[0];

  const blockees = blocks.map((block) => block.blockeeId);

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
    children,
    blockees,
    createdAt,
    updatedAt,
  };
};

@injectable()
export class ServiceManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICE_REPOSITORY_SYMBOL) private readonly serviceRepository: ServiceRepository,
    @inject(SERVICES.MEDIATOR) private readonly mediator: IMediator
  ) {}

  public async detail(serviceId: string): Promise<FlattedDetailedService> {
    this.logger.info({ msg: 'detailing service', serviceId });

    const service = await this.serviceRepository.findDetailedServiceById(serviceId);

    if (service === null) {
      this.logger.error({ msg: 'service not found', serviceId });
      throw new ServiceNotFoundError(`service ${serviceId} not found`);
    }

    const descendantTree = (await this.serviceRepository.findDescendants(service, true, 1)) as Service;

    service.blocks = await this.serviceRepository.findBlocks(service.id);

    return flattenDetailedService(
      service,
      descendantTree.children.map((children) => children.id)
    );
  }

  public async rotate(serviceId: string): Promise<void> {
    this.logger.info({ msg: 'rotating service', serviceId });

    const service = await this.serviceRepository.findOneBy({ id: serviceId });

    if (service === null) {
      this.logger.error({ msg: 'service not found', serviceId });
      throw new ServiceNotFoundError(`service ${serviceId} not found`);
    }

    const descendants = (await this.serviceRepository.findDescendants(service, false)) as Service[];
    const serviceIds = descendants.map((descendant) => descendant.id);

    this.logger.info({ msg: 'locking services', serviceIds });

    const lock = await this.mediator.createLock({
      services: serviceIds,
      expiration: ROTATION_LOCK_EXPIRATION_MS,
      reason: `service ${serviceId} rotation`,
    });

    this.logger.info({ msg: 'locked services', serviceIds, lock });

    try {
      const filterActionPromises = serviceIds.map(async (serviceId) => {
        const activeActions = await this.mediator.filterActions({ service: serviceId, status: [ActionStatus.ACTIVE], limit: 1 });
        if (activeActions.length > 0) {
          this.logger.error({ msg: `service ${serviceId} has active actions`, serviceId });
          throw new ServiceIsActiveError(`service ${serviceId} has active actions`);
        }
      });
      await Promise.all(filterActionPromises);
    } catch (error) {
      this.logger.info({ msg: 'unlocking services', serviceIds, lock });
      // TODO: this could also fail
      await this.mediator.removeLock(lock.lockId);

      throw error;
    }

    const rotationIds = await this.serviceRepository.createServiceRotation(serviceId);

    this.logger.info({
      msg: 'rotation creation completed',
      serviceIds,
      lock,
      rotationIds,
      rotationIdsCount: rotationIds.length,
    });

    this.logger.info({ msg: 'unlocking services', serviceIds, lock });
    await this.mediator.removeLock(lock.lockId);
  }
}
