import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { HttpError } from '../../common/errors';
import { Action, ActionParams, UpdateableActionParams } from '../models/action';
import { ActionManager } from '../models/actionManager';
import { ActionAlreadyClosedError, ActionNotFoundError } from '../models/errors';

interface ActionId {
  actionId: string
};

type GetActionsHandler = RequestHandler<undefined, Action[]>;
type PostActionHandler = RequestHandler<undefined, ActionId, ActionParams>;
type PatchActionHandler = RequestHandler<ActionId, undefined, UpdateableActionParams>;

@injectable()
export class ActionController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(ActionManager) private readonly manager: ActionManager) { }

  public getActions: GetActionsHandler = async (req, res, next) => {
    try {
      // const filter: PublicReplicaFilter = convertObjectToCamelCase(req.query);
      const actions = await this.manager.getActions();
      return res.status(httpStatus.OK).json(actions);
    } catch (error) {
      return next(error);
    }
  };

  public postAction: PostActionHandler = async (req, res, next) => {
    try {
      const createdAction = await this.manager.createAction(req.body);
      return res.status(httpStatus.CREATED).json({ actionId: createdAction.actionId });
    } catch (error) {
      if (error instanceof Error) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };

  public patchAction: PatchActionHandler = async (req, res, next) => {
    try {
      await this.manager.updateAction(req.params.actionId, req.body);
      return res.status(httpStatus.OK).json();
    } catch (error) {
      if (error instanceof ActionNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      if (error instanceof ActionAlreadyClosedError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };
}
