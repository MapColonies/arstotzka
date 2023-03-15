import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { Service } from '../DAL/typeorm/service';
import { ServiceRepository, SERVICE_REPOSITORY_SYMBOL } from '../DAL/typeorm/serviceRepository';
import { getActiveActionsMock } from './actionyMock';
import { ServiceIsActiveError, ServiceNotFoundError } from './errors';
import { lockServicesMock, unlockServicesMock } from './lockyMock';
import { DetailedService, FlattedDetailedService } from './service';

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
    @inject(SERVICE_REPOSITORY_SYMBOL) private readonly serviceRepository: ServiceRepository
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

    const lock = await lockServicesMock({ services: serviceIds, expiration: 1000 });

    this.logger.info({ msg: 'locked services', serviceIds, lock });

    try {
      // TODO: in promise all fashion
      for await (const serviceId of serviceIds) {
        const activeActions = await getActiveActionsMock(serviceId);
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

      this.logger.info({ msg: 'unlocking services', serviceIds, lock });
      // TODO: this could also fail
      await unlockServicesMock(lock.lockId);

      throw error;
    }

    const insertionResult = await this.serviceRepository.createServiceRotation(serviceId);

    this.logger.info({
      msg: 'rotation creation completed',
      serviceIds,
      lock,
      insertResult: insertionResult.generatedMaps,
      insertCount: insertionResult.generatedMaps.length,
    });

    this.logger.info({ msg: 'unlocking services', serviceIds, lock });
    await unlockServicesMock(lock.lockId);
  }
}
