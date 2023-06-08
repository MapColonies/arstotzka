import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { ServiceNotFoundError, ServiceAlreadyLockedError, LockRequest, LockNotFoundError } from '@map-colonies/arstotzka-common';
import { ActiveBlockingActionsError } from '../models/errors';
import { HttpError } from '../../common/errors';
import { SERVICES } from '../../common/constants';
import { LockManager } from '../models/lockManager';
import { LockId } from '../models/lock';

type CreateLockHandler = RequestHandler<undefined, LockId, LockRequest>;
type DeleteLockHandler = RequestHandler<LockId>;
type ReserveAccessHandler = RequestHandler<undefined, LockId, undefined, { service: string }>;

@injectable()
export class LockController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(LockManager) private readonly manager: LockManager) {}

  public createLock: CreateLockHandler = async (req, res, next) => {
    try {
      const lock = await this.manager.lock(req.body);
      return res.status(httpStatus.CREATED).json(lock);
    } catch (error) {
      if (error instanceof ServiceAlreadyLockedError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };

  public deleteLock: DeleteLockHandler = async (req, res, next) => {
    try {
      await this.manager.unlock(req.params.lockId);
      return res.status(httpStatus.NO_CONTENT).json();
    } catch (error) {
      if (error instanceof LockNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      return next(error);
    }
  };

  public reserveAccess: ReserveAccessHandler = async (req, res, next) => {
    try {
      const lock = await this.manager.reserve(req.query.service);
      if (lock === undefined) {
        return res.status(httpStatus.NO_CONTENT).json();
      }
      return res.status(httpStatus.CREATED).json(lock);
    } catch (error) {
      if (error instanceof ServiceNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      } else if (error instanceof ServiceAlreadyLockedError || error instanceof ActiveBlockingActionsError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };
}
