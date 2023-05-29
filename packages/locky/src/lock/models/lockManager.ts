import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { IMediator } from '@map-colonies/arstotzka-mediator';
import { ActionStatus, LockNotFoundError, LockRequest, ServiceAlreadyLockedError } from '@map-colonies/arstotzka-common';
import { SERVICES } from '../../common/constants';
import { IAppConfig } from '../../common/interfaces';
import { LockRepository, LOCK_REPOSITORY_SYMBOL } from '../DAL/typeorm/lockRepository';
import { ActiveBlockingActionsError } from './errors';
import { LockId } from './lock';

@injectable()
export class LockManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(LOCK_REPOSITORY_SYMBOL) private readonly lockRepository: LockRepository,
    @inject(SERVICES.MEDIATOR) private readonly mediator: IMediator,
    @inject(SERVICES.APP) private readonly app: IAppConfig
  ) {}

  public async lock(lockRequest: LockRequest): Promise<LockId> {
    this.logger.info({ msg: 'attempting to lock services', lockRequest });

    const nonexpired = await this.lockRepository.findNonexpiredLocks(lockRequest.services);

    if (nonexpired.length > 0) {
      this.logger.info({ msg: 'found nonexpired locks on services', lockRequest, nonexpired });
      throw new ServiceAlreadyLockedError('could not lock at least one of requested services due to nonexpired lock');
    }

    const lockId = await this.lockRepository.createLock(lockRequest);

    this.logger.info({ msg: 'created lock on services', lockRequest, lockId });

    return { lockId };
  }

  public async unlock(lockId: string): Promise<void> {
    this.logger.info({ msg: 'attempting to unlock', lockId });

    const lock = await this.lockRepository.findOneBy({ lockId });

    if (lock === null) {
      this.logger.error({ msg: 'lock not found', lockId });
      throw new LockNotFoundError(`lock ${lockId} not found`);
    }

    await this.lockRepository.deleteLock(lockId);

    this.logger.info({ msg: 'unlocked', lock });
  }

  public async reserve(serviceId: string): Promise<LockId | undefined> {
    this.logger.info({ msg: 'attempting to reserve access for service', serviceId });

    // validate the reserving service isn't locked
    const nonexpiredLocks = await this.lockRepository.findNonexpiredLocks([serviceId]);
    if (nonexpiredLocks.length > 0) {
      this.logger.error({ msg: 'found nonexpired locks on service', serviceId, nonexpiredLocks });
      throw new ServiceAlreadyLockedError('could not reserve access for service due to nonexpired locks');
    }

    // get the service from the registry, this validates the service really exists and gets its blockees
    const service = await this.mediator.fetchService(serviceId);

    this.logger.debug({ msg: 'fetched service', serviceId, service });

    if (service.blockees.length === 0) {
      this.logger.info({ msg: 'service has no configured blockee services, no need to lock', serviceId });
      return;
    }

    // lock blockees services
    const lockId = await this.lockRepository.createLock({
      services: service.blockees.map((blockee) => blockee.serviceId),
      expiration: this.app.reserveLockExpiration,
      reason: `${service.namespaceName} ${service.serviceName} ${serviceId} access reserve`,
    });

    try {
      // for each of the blocking services get the active actions and expect none, if there are unlock the created locks and throw
      const filterActionPromises = service.blockees.map(async (blockee) => {
        let actions: unknown[] = [];

        if (this.app.serviceToActionsUrlMap.has(blockee.serviceName)) {
          actions = await this.mediator.filterActions<{ id: string }, { status: 'inprogress' }>(
            { status: 'inprogress' },
            { url: this.app.serviceToActionsUrlMap.get(blockee.serviceName) as string }
          );
        } else {
          actions = await this.mediator.filterActions({ service: blockee.serviceId, status: [ActionStatus.ACTIVE], limit: 1 });
        }

        if (actions.length > 0) {
          this.logger.error({ msg: 'found active actions on blockee service', serviceId, blockee, actions });
          throw new ActiveBlockingActionsError('could not reserve access for service due to active blocking actions');
        }
      });

      await Promise.all(filterActionPromises);
    } catch (error) {
      this.logger.info({ msg: 'unlocking blockees services', lockId });

      await this.lockRepository.deleteLock(lockId);

      throw error;
    }

    return { lockId };
  }
}
