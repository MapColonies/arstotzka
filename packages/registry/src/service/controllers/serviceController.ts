import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { ServiceNotFoundError, ServiceAlreadyLockedError, FlattedDetailedService } from '@map-colonies/arstotzka-common';
import { HttpError } from '../../common/errors';
import { SERVICES } from '../../common/constants';
import { ServiceManager } from '../models/serviceManager';
import { ServiceIsActiveError } from '../models/errors';

type GetServiceHandler = RequestHandler<{ serviceId: string }, FlattedDetailedService>;
type RotateServiceHandler = RequestHandler<{ serviceId: string }>;

@injectable()
export class ServiceController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(ServiceManager) private readonly manager: ServiceManager) {}

  public getService: GetServiceHandler = async (req, res, next) => {
    try {
      const detailedService = await this.manager.detail(req.params.serviceId);
      return res.status(httpStatus.OK).json(detailedService);
    } catch (error) {
      if (error instanceof ServiceNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      return next(error);
    }
  };

  public rotateService: RotateServiceHandler = async (req, res, next) => {
    try {
      await this.manager.rotate(req.params.serviceId);
      return res.status(httpStatus.NO_CONTENT).json();
    } catch (error) {
      if (error instanceof ServiceNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      if (error instanceof ServiceAlreadyLockedError || error instanceof ServiceIsActiveError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };
}
