import { Logger } from '@map-colonies/js-logger';
import { IMediator } from '@map-colonies/arstotzka-mediator';
import { ActionStatus, ServiceNotFoundError, FlattedDetailedService } from '@map-colonies/arstotzka-common';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { Service } from '../DAL/typeorm/service';
import { ServiceRepository, SERVICE_REPOSITORY_SYMBOL } from '../DAL/typeorm/serviceRepository';
import { IAppConfig } from '../../common/interfaces';
import { ServiceIsActiveError } from './errors';
import { flattenDetailedService } from './util';
import { RotationRequest } from './service';

@injectable()
export class ServiceManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICE_REPOSITORY_SYMBOL) private readonly serviceRepository: ServiceRepository,
    @inject(SERVICES.MEDIATOR) private readonly mediator: IMediator,
    @inject(SERVICES.APP) private readonly app: IAppConfig
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

  public async rotate(rotationRequest: RotationRequest): Promise<void> {
    const { serviceId } = rotationRequest;

    this.logger.info({ msg: 'rotating service', rotationRequest });

    const service = await this.serviceRepository.findOneBy({ id: serviceId });

    if (service === null) {
      this.logger.error({ msg: 'service not found', serviceId });
      throw new ServiceNotFoundError(`service ${serviceId} not found`);
    }

    this.logger.debug({ msg: 'found service', serviceId, service });

    // find flat descendant tree and lock them, a service is a descentant of itself
    const descendants = (await this.serviceRepository.findDescendants(service, false)) as Service[];

    this.logger.info({ msg: 'locking services', rotatingService: serviceId, services: descendants });

    const lock = await this.mediator.createLock({
      services: descendants.map((descendant) => descendant.id),
      expiration: this.app.rotationLockExpiration,
      reason: `service ${serviceId} rotation`,
    });

    this.logger.info({ msg: 'locked services', services: descendants, lock });

    try {
      // validate no active actions on the services, if so unlock and throw
      const filterActionPromises = descendants.map(async (descendant) => {
        let actions: unknown[] = [];

        if (this.app.serviceToActionsUrlMap.has(descendant.name)) {
          actions = await this.mediator.filterActions<{ id: string }, { status: 'inprogress' }>(
            { status: 'inprogress' },
            { url: this.app.serviceToActionsUrlMap.get(descendant.name) as string }
          );
        } else {
          actions = await this.mediator.filterActions({ service: descendant.id, status: [ActionStatus.ACTIVE], limit: 1 });
        }

        if (actions.length > 0) {
          this.logger.error({ msg: `service ${descendant.id} has active actions`, descendant });
          throw new ServiceIsActiveError(`service ${descendant.id} has active actions`);
        }
      });

      await Promise.all(filterActionPromises);
    } catch (error) {
      this.logger.info({ msg: 'unlocking services', services: descendants, lock });
      // TODO: this could fail handle LockNotFoundError
      await this.mediator.removeLock(lock.lockId);

      throw error;
    }

    // create the new rotations for the whole service tree
    const rotations = await this.serviceRepository.createServiceRotation(rotationRequest);

    this.logger.info({
      msg: 'rotation completed',
      services: descendants,
      lock,
      rotations: rotations,
      rotationsCount: rotations.length,
      rotationRequest,
    });

    this.logger.info({ msg: 'unlocking services', services: descendants, lock });

    // TODO: this could also fail handle LockNotFoundError
    await this.mediator.removeLock(lock.lockId);
  }
}
