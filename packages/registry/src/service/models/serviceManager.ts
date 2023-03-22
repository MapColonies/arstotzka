import { Logger } from '@map-colonies/js-logger';
import { IMediator } from '@map-colonies/arstotzka-mediator';
import { ActionStatus, ServiceNotFoundError } from '@map-colonies/arstotzka-common';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { Service } from '../DAL/typeorm/service';
import { ServiceRepository, SERVICE_REPOSITORY_SYMBOL } from '../DAL/typeorm/serviceRepository';
import { ServiceIsActiveError } from './errors';
import { FlattedDetailedService } from './service';
import { flattenDetailedService } from './util';

const ROTATION_LOCK_EXPIRATION_MS = 60000;

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

    this.logger.debug({ msg: 'found service', serviceId, service });

    // find flat descendant tree and lock them, the function also returns the service itself
    const descendants = (await this.serviceRepository.findDescendants(service, false)) as Service[];
    const serviceIds = descendants.map((descendant) => descendant.id);

    this.logger.info({ msg: 'locking services', rotatingService: serviceId, serviceIds });

    const lock = await this.mediator.createLock({
      services: serviceIds,
      expiration: ROTATION_LOCK_EXPIRATION_MS,
      reason: `service ${serviceId} rotation`,
    });

    this.logger.info({ msg: 'locked services', serviceIds, lock });

    try {
      // validate no active actions on the services, if so unlock and throw
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
      // TODO: this could fail handle LockNotFoundError
      await this.mediator.removeLock(lock.lockId);

      throw error;
    }

    // create the new rotations for the whole service tree
    const rotations = await this.serviceRepository.createServiceRotation(serviceId);

    this.logger.info({
      msg: 'rotation creation completed',
      serviceIds,
      lock,
      rotations: rotations,
      rotationsCount: rotations.length,
    });

    this.logger.info({ msg: 'unlocking services', serviceIds, lock });

    // TODO: this could also fail handle LockNotFoundError
    await this.mediator.removeLock(lock.lockId);
  }
}
