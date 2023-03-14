import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { LOCK_IDENTIFIER_COLUMN } from '../DAL/typeorm/lock';
import { LockRepository, LOCK_REPOSITORY_SYMBOL } from '../DAL/typeorm/lockRepository';
import { LockNotFoundError, ServiceAlreadyLockedError } from './errors';
import { LockId } from './lock';

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

    const insertId = await this.lockRepository.createLock(lockRequest);

    const lockId = insertId.generatedMaps[0][LOCK_IDENTIFIER_COLUMN] as string;

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

  public async reserve(serviceId: string): Promise<LockId> {
    this.logger.info({ msg: 'attempting to reserve access for service', serviceId });

    await this.lockRepository.findOneBy({ lockId: serviceId });

    return { lockId: 'lockId' };
  }
}
