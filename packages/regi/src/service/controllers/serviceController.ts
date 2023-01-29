import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';

import { IResourceNameModel, ServiceManager } from '../models/serviceManager';

type CreateResourceHandler = RequestHandler<undefined, IResourceNameModel, IResourceNameModel>;
type GetResourceHandler = RequestHandler<undefined, IResourceNameModel>;

@injectable()
export class ServiceController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(ServiceManager) private readonly manager: ServiceManager) {}

  public getResource: GetResourceHandler = (req, res) => {
    return res.status(httpStatus.OK).json(this.manager.getResource());
  };

  public createResource: CreateResourceHandler = (req, res) => {
    const createdResource = this.manager.createResource(req.body);
    return res.status(httpStatus.CREATED).json(createdResource);
  };
}
