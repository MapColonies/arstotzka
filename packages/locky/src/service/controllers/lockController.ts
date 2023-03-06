import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IResourceNameModel, LockManager } from '../models/lockManager';

type CreateResourceHandler = RequestHandler<undefined, IResourceNameModel, IResourceNameModel>;
type GetResourceHandler = RequestHandler<undefined, IResourceNameModel>;

@injectable()
export class LockController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(LockManager) private readonly manager: LockManager) {}

  public getResource: GetResourceHandler = (req, res) => {
    return res.status(httpStatus.OK).json(this.manager.getResource());
  };

  public createResource: CreateResourceHandler = (req, res) => {
    const createdResource = this.manager.createResource(req.body);
    return res.status(httpStatus.CREATED).json(createdResource);
  };
}