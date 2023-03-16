import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { VectorManagementClient } from '@map-colonies/vector-management-client';
import { ActionStatus } from '@map-colonies/vector-management-common';
import { SERVICES } from '../../common/constants';
import { LOCK_IDENTIFIER_COLUMN } from '../DAL/typeorm/lock';
import { LockRepository, LOCK_REPOSITORY_SYMBOL } from '../DAL/typeorm/lockRepository';
import { ActiveBlockingActionsError, LockNotFoundError, ServiceAlreadyLockedError } from './errors';
import { LockId } from './lock';

const SERVICE_RESERVATION_LOCK_EXPIRATION = 60000;

export interface LockRequest {
  services: string[];
  expiration?: number;
  reason?: string;
}

@injectable()
export class LockManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(LOCK_REPOSITORY_SYMBOL) private readonly lockRepository: LockRepository
  ) {}

  public async lock(lockRequest: LockRequest): Promise<LockId> {
    this.logger.info({ msg: 'attempting to lock services', lockRequest });

    const nonexpired = await this.lockRepository.findNonexpiredLocks(lockRequest.services);

    if (nonexpired.length > 0) {
      this.logger.info({ msg: 'found nonexpired locks on services', lockRequest, nonexpired });
      throw new ServiceAlreadyLockedError('could not lock at least one of requested services');
    }

    const insertResult = await this.lockRepository.createLock(lockRequest);

    const lockId = insertResult.generatedMaps[0][LOCK_IDENTIFIER_COLUMN] as string;

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

    // get the service from the registry ,this validates the service really exists and gets its blockees
    const client = new VectorManagementClient({
      registry: { endpoint: 'http://localhost:8081' },
      actiony: { endpoint: 'http://localhost:8080' },
      logger: this.logger,
    });
    const service = await client.getService(serviceId);

    if (service.blockees.length === 0) {
      this.logger.info({ msg: 'service has no configured blockee services, no need to lock', serviceId });
      return;
    }

    // lock blocked by services
    const insertResult = await this.lockRepository.createLock({
      services: service.blockees,
      expiration: SERVICE_RESERVATION_LOCK_EXPIRATION,
      reason: `${serviceId} access reserve`,
    });

    const lockId = insertResult.generatedMaps[0][LOCK_IDENTIFIER_COLUMN] as string;

    try {
      // for each of the blocking services get the active actions and expect none
      const getActionPromises = service.blockees.map(async (blockeeId) => {
        const actions = await client.getActions({ service: blockeeId, status: [ActionStatus.ACTIVE], limit: 1 });
        if (actions.length > 0) {
          this.logger.error({ msg: 'found active actions on blockee service', serviceId, blockeeId, actions });
          throw new ActiveBlockingActionsError('could not reserve access for service due to active blocking actions');
        }
      });

      await Promise.all(getActionPromises);
    } catch (error) {
      // unlock blocking services
      await this.lockRepository.deleteLock(lockId);
      throw error;
    }

    return { lockId };
  }
}
